import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { ContractModel } from '../../contracts/contract.model';
import { ContractVersionModel } from '../../contracts/contract-version.model';
import { FirmModel } from '../../firms/firm.model';
import { DriverModel } from '../../drivers/driver.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { TripModel } from '../../trips/trip.model';
import { InvoiceModel } from '../invoice.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Invoice Owner',
    email: 'invoice-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'invoice-owner@test.com', password: 'password123' });

  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await InvoiceModel.deleteMany({});
  await TripModel.deleteMany({});
  await ContractVersionModel.deleteMany({});
  await ContractModel.deleteMany({});
  await FirmModel.deleteMany({});
  await VehicleModel.deleteMany({});
  await DriverModel.deleteMany({});
});

const rules = (fuelRatePerLitre: number) => ({
  capacityRates: [
    {
      capacity: 29000,
      contractualAverageKmPerLitre: 2.5,
      baseHiringRatePerRound: 4500,
      hiringMultiplierRules: [{ minKm: 0, maxKm: 500, multiplier: 1 }],
    },
  ],
  fuelRatePerLitre,
  kmThresholds: [
    { upToKm: 127, rounds: 0.5 },
    { upToKm: 500, rounds: 1 },
    { upToKm: 700, rounds: 1.5 },
    { rounds: 2 },
  ],
  tollTreatment: 'actual',
  otherBillableCharges: [{ code: 'loading', name: 'Loading charge', amount: 100, basis: 'perTrip', isActive: true }],
});

const createFirmAndVehicleDriverContract = async () => {
  const firm = await FirmModel.create({ name: 'Billing Test Firm', billingName: 'Billing Test Firm' });
  const vehicle = await VehicleModel.create({
    registrationNumber: 'KA01AB1234',
    vehicleType: 'truck',
    capacity: 29000,
    firmId: firm._id,
    isActive: true,
  });
  const driver = await DriverModel.create({
    name: 'Invoice Driver',
    phone: '9876543210',
    licenseNumber: 'DL00000001',
    mobile: '9876543210',
    dailyWage: 1200,
    vehicleId: vehicle._id,
    firmId: firm._id,
    isActive: true,
  });
  const contract = await ContractModel.create({
    firmId: firm._id,
    companyId: new mongoose.Types.ObjectId(),
    name: 'Invoice Contract 2026',
    isActive: true,
  });
  const contractVersion = await ContractVersionModel.create({
    contractId: contract._id,
    version: 1,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    billingRules: rules(95.81),
  });

  return { firm, vehicle, driver, contract, contractVersion };
};

describe('Monthly invoice lifecycle and snapshot generation', () => {
  it('generates a firm-month vehicle invoice from eligible trips and stores immutable snapshots', async () => {
    const { firm, vehicle, driver, contract, contractVersion } = await createFirmAndVehicleDriverContract();

    const tripA = await TripModel.create({
      tripDate: new Date('2026-02-10T00:00:00.000Z'),
      vehicleId: vehicle._id,
      driverId: driver._id,
      firmId: firm._id,
      contractId: contract._id,
      contractVersionId: contractVersion._id,
      pickupLocation: 'Factory',
      dropLocation: 'Market',
      totalKm: 120,
      operationalStatus: 'completed',
      toll: { amount: 250 },
    });

    const tripB = await TripModel.create({
      tripDate: new Date('2026-02-15T00:00:00.000Z'),
      vehicleId: vehicle._id,
      driverId: driver._id,
      firmId: firm._id,
      contractId: contract._id,
      contractVersionId: contractVersion._id,
      pickupLocation: 'Factory',
      dropLocation: 'Depot',
      totalKm: 220,
      operationalStatus: 'completed',
      toll: { amount: 120 },
    });

    const firmId = String((firm as any)._id);
    const vehicleId = String((vehicle as any)._id);

    const response = await request(app)
      .post('/api/v1/invoices/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ firmId, vehicleId, month: 2, year: 2026 });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('draft');
    expect(response.body.data.lineItems).toHaveLength(2);
    expect(response.body.data.lineItems[0].snapshot.totalAmount).toBeDefined();
    expect(response.body.data.summary.vehicleCount).toBe(1);
    expect(response.body.data.summary.totalDistanceKm).toBe(340);
    expect(response.body.data.lineItems[0].tripSnapshot.vehicle.registrationNumber).toBe('KA01AB1234');
    expect(response.body.data.lineItems[0].tripSnapshot.driver.name).toBe('Invoice Driver');
    expect(response.body.data.lineItems[0].tripSnapshot.totalKm).toBe(120);
    expect(response.body.data.lineItems[0].tripSnapshot.operationalStatus).toBe('completed');
    expect(response.body.data.lineItems[0].tripSnapshot.contractVersion.version).toBe(1);
    expect(response.body.data.summary.totalAmount).toBeGreaterThan(0);
    expect(response.body.data.duplicateTripGuard).toBeDefined();

    const tripAId = String((tripA as any)._id);
    const tripBId = String((tripB as any)._id);
    const tripIds = response.body.data.lineItems.map((item: any) => item.tripId);
    expect(tripIds).toEqual(expect.arrayContaining([tripAId, tripBId]));

    const duplicateResponse = await request(app)
      .post('/api/v1/invoices/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ firmId, vehicleId, month: 2, year: 2026 });

    expect(duplicateResponse.status).toBe(409);
  });

  it('approves and finalizes an invoice without recalculating historical snapshot values', async () => {
    const { firm, vehicle, driver, contract, contractVersion } = await createFirmAndVehicleDriverContract();

    const trip = await TripModel.create({
      tripDate: new Date('2026-03-01T00:00:00.000Z'),
      vehicleId: vehicle._id,
      driverId: driver._id,
      firmId: firm._id,
      contractId: contract._id,
      contractVersionId: contractVersion._id,
      pickupLocation: 'Warehouse',
      dropLocation: 'Customer',
      totalKm: 150,
      operationalStatus: 'completed',
      toll: { amount: 300 },
    });

    const firmId = String((firm as any)._id);
    const vehicleId = String((vehicle as any)._id);
    const tripId = String((trip as any)._id);

    const generated = await request(app)
      .post('/api/v1/invoices/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ firmId, vehicleId, month: 3, year: 2026 });

    const approval = await request(app)
      .patch(`/api/v1/invoices/${generated.body.data._id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Approved by owner' });

    expect(approval.status).toBe(200);
    expect(approval.body.data.status).toBe('approved');

    const finalize = await request(app)
      .patch(`/api/v1/invoices/${generated.body.data._id}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Finalized for billing cycle' });

    expect(finalize.status).toBe(200);
    expect(finalize.body.data.status).toBe('finalized');
    expect(finalize.body.data.lineItems[0].snapshot.totalAmount).toBeDefined();

    const draftPdfResponse = await request(app)
      .get(`/api/v1/invoices/${generated.body.data._id}/pdf`)
      .set('Authorization', `Bearer ${token}`);
    expect(draftPdfResponse.status).toBe(200);
    expect(draftPdfResponse.headers['content-type']).toContain('application/pdf');
    expect(draftPdfResponse.headers['content-disposition']).toContain('.pdf');
    expect(draftPdfResponse.body.subarray(0, 4).toString()).toBe('%PDF');

    const stored = await InvoiceModel.findById(generated.body.data._id).lean();
    expect(stored?.status).toBe('finalized');
    expect(stored?.lineItems[0].snapshot.totalAmount).toBeDefined();
    expect(String(stored?.lineItems[0].tripId)).toBe(tripId);
  });

  it('rejects PDF downloads until the invoice is finalized', async () => {
    const { firm, vehicle, driver, contract, contractVersion } = await createFirmAndVehicleDriverContract();
    await TripModel.create({
      tripDate: new Date('2026-04-01T00:00:00.000Z'),
      vehicleId: vehicle._id,
      driverId: driver._id,
      firmId: firm._id,
      contractId: contract._id,
      contractVersionId: contractVersion._id,
      pickupLocation: 'Warehouse',
      dropLocation: 'Customer',
      totalKm: 150,
      operationalStatus: 'completed',
      toll: { amount: 0 },
    });

    const generated = await request(app)
      .post('/api/v1/invoices/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ firmId: String((firm as any)._id), vehicleId: String((vehicle as any)._id), month: 4, year: 2026 });
    const response = await request(app)
      .get(`/api/v1/invoices/${generated.body.data._id}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
  });
});
