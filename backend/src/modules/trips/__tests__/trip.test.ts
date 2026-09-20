import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { DriverModel } from '../../drivers/driver.model';
import { RouteModel } from '../../routes/route.model';
import { ContractModel } from '../../contracts/contract.model';
import { ContractVersionModel } from '../../contracts/contract-version.model';
import { TripModel } from '../trip.model';

let mongoServer: MongoMemoryServer;
let token!: string;
let firmId!: string;
let vehicleId!: string;
let driverId!: string;
let routeId!: string;
let contractId!: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Trip Admin',
    email: 'trip-admin@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  });
  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'trip-admin@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({ name: 'Trip Test Firm' });
  firmId = String(firm._id);
  const vehicle = await VehicleModel.create({
    registrationNumber: 'TRIP001',
    vehicleType: 'Truck',
    capacity: 29000,
    firmId: firm._id,
  });
  vehicleId = String(vehicle._id);
  const driver = await DriverModel.create({
    name: 'Trip Driver',
    mobile: '9999999999',
    dailyWage: 500,
  });
  driverId = String(driver._id);
  const route = await RouteModel.create({
    name: 'Trip Test Route',
    pickupLocation: 'Origin',
    dropLocation: 'Destination',
  });
  routeId = String(route._id);
  const contract = await ContractModel.create({ firmId: firm._id, name: 'Trip Contract' });
  contractId = String(contract._id);
  await ContractVersionModel.create({
    contractId: contract._id,
    version: 1,
    effectiveFrom: new Date('2026-01-01'),
    billingRules: {
      capacityRates: [{ capacity: 29000, contractualAverageKmPerLitre: 2.5, baseHiringRatePerRound: 4500 }],
      fuelRatePerLitre: 95.81,
      kmThresholds: [{ upToKm: 500, rounds: 1 }, { rounds: 1.5 }],
      tollTreatment: 'actual',
      otherBillableCharges: [],
    },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await TripModel.deleteMany({});
});

const validTrip = () => ({
  tripDate: '2026-06-15',
  vehicleId,
  driverId,
  firmId,
  contractId,
  routeId,
  pickupLocation: 'Origin',
  dropLocation: 'Destination',
  startKm: 1000,
  endKm: 1589,
  totalKm: 589,
  operationalStatus: 'completed',
  toll: { amount: 4680, reference: 'FASTAG-1' },
  operationalInfo: { loadType: 'milk' },
  notes: 'June test trip',
});

const createTrip = (payload = validTrip()) => request(app)
  .post('/api/v1/trips')
  .set('Authorization', `Bearer ${token}`)
  .send(payload);

describe('Trips Module', () => {
  it('creates a trip with the actual vehicle, driver, and effective contract version', async () => {
    const response = await createTrip();

    expect(response.status).toBe(201);
    expect(response.body.data.vehicleId).toBe(vehicleId);
    expect(response.body.data.driverId).toBe(driverId);
    expect(response.body.data.firmId).toBe(firmId);
    expect(response.body.data.totalKm).toBe(589);
    expect(response.body.data.contractVersionId).toBeDefined();
    expect(response.body.data.toll.amount).toBeDefined();
    expect(response.body.data.operationalInfo.loadType).toBe('milk');
  });

  it('validates kilometer values and reference ownership', async () => {
    const invalidKm = await createTrip({ ...validTrip(), endKm: 900, totalKm: 589 });
    expect(invalidKm.status).toBe(400);

    const missingReference = await createTrip({ ...validTrip(), vehicleId: new mongoose.Types.ObjectId().toString() });
    expect(missingReference.status).toBe(404);
  });

  it('updates and retrieves a trip without calculating an invoice', async () => {
    const created = await createTrip();
    const tripId = created.body.data._id;

    const update = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dropLocation: 'Updated Destination', totalKm: 600, endKm: 1600 });
    expect(update.status).toBe(200);
    expect(update.body.data.dropLocation).toBe('Updated Destination');
    expect(update.body.data).not.toHaveProperty('tripTotal');
    expect(update.body.data).not.toHaveProperty('hiringCharge');

    const get = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.data._id).toBe(tripId);
  });

  it('supports search, filters, monthly listing, and pagination', async () => {
    await createTrip();
    await createTrip({ ...validTrip(), tripDate: '2026-07-10', pickupLocation: 'Second Origin', notes: 'July test trip' });

    const month = await request(app)
      .get('/api/v1/trips?month=2026-06&vehicleId=' + vehicleId + '&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(month.status).toBe(200);
    expect(month.body.data.data).toHaveLength(1);
    expect(month.body.data.meta).toMatchObject({ total: 1, page: 1, limit: 1 });

    const search = await request(app)
      .get('/api/v1/trips?search=July')
      .set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.data).toHaveLength(1);

    const driverFilter = await request(app)
      .get('/api/v1/trips?driverId=' + driverId + '&firmId=' + firmId)
      .set('Authorization', `Bearer ${token}`);
    expect(driverFilter.body.data.meta.total).toBe(2);
  });

  it('cancels a trip through soft deletion and excludes it from lists', async () => {
    const created = await createTrip({ ...validTrip(), operationalStatus: 'planned' });
    const tripId = created.body.data._id;

    const response = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);

    const stored = await TripModel.findById(tripId);
    expect(stored?.isDeleted).toBe(true);
    expect(stored?.operationalStatus).toBe('cancelled');

    const list = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.data).toHaveLength(0);
  });
});