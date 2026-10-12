import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { DriverModel } from '../../drivers/driver.model';
import { ContractModel } from '../../contracts/contract.model';
import { ContractVersionModel } from '../../contracts/contract-version.model';
import { TripModel } from '../../trips/trip.model';
import { InvoiceModel } from '../../invoices/invoice.model';
import { PaymentModel } from '../../payments/payment.model';
import { ExpenseModel } from '../../expenses/expense.model';
import { VehicleDocumentModel } from '../../documents/vehicle-document.model';
import { SalaryRecordModel } from '../../salary/salary-record.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token!: string;
let userId!: string;
let firmId!: string;
let vehicleId!: string;
let driverId!: string;
let contractId!: string;
let contractVersionId!: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  const user = await UserModel.create({
    name: 'Reports Owner',
    email: 'reports-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });
  userId = String(user._id);
  const loginResponse = await request(app).post('/api/v1/auth/login').send({ email: 'reports-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({ name: 'Reports Test Firm', billPrefix: 'RPT' });
  firmId = String(firm._id);
  const vehicle = await VehicleModel.create({ registrationNumber: 'RPT001', vehicleType: 'Truck', capacity: 29000, firmId: firm._id, vehicleNumberPerFirm: 1 });
  vehicleId = String(vehicle._id);
  const driver = await DriverModel.create({ name: 'Reports Driver', mobile: '9876500001', dailyWage: 600 });
  driverId = String(driver._id);
  const contract = await ContractModel.create({ firmId: firm._id, name: 'Reports Contract' });
  contractId = String(contract._id);
  const version = await ContractVersionModel.create({
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
  contractVersionId = String(version._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await InvoiceModel.deleteMany({});
  await PaymentModel.deleteMany({});
  await ExpenseModel.deleteMany({});
  await TripModel.deleteMany({});
  await VehicleDocumentModel.deleteMany({});
  await SalaryRecordModel.deleteMany({});
});

async function generateFinalizedInvoice(totalKm: number) {
  await TripModel.create({
    tripDate: new Date('2026-11-05T08:00:00.000Z'),
    vehicleId, driverId, firmId, contractId, contractVersionId,
    pickupLocation: 'A', dropLocation: 'B', totalKm,
    operationalStatus: 'completed',
    toll: { amount: 200 },
  });

  const generated = await request(app)
    .post('/api/v1/invoices/generate')
    .set('Authorization', `Bearer ${token}`)
    .send({ firmId, vehicleId, month: 11, year: 2026 });
  const invoiceId = generated.body.data._id;
  await request(app).patch(`/api/v1/invoices/${invoiceId}/approve`).set('Authorization', `Bearer ${token}`).send({});
  await request(app).patch(`/api/v1/invoices/${invoiceId}/finalize`).set('Authorization', `Bearer ${token}`).send({});
  return invoiceId as string;
}

describe('Reports module', () => {
  it('reports vehicle revenue, expenses, and margin for the month', async () => {
    const invoiceId = await generateFinalizedInvoice(300);
    const invoice = await InvoiceModel.findById(invoiceId).lean();

    await ExpenseModel.create({ category: 'fuel', date: new Date('2026-11-10'), amount: 4000, vehicle: vehicleId, description: 'Diesel fill-up', createdBy: userId });

    const response = await request(app)
      .get('/api/v1/reports/vehicle-revenue?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const row = response.body.data.find((item: { vehicleId: string }) => item.vehicleId === vehicleId);
    expect(row).toBeDefined();
    expect(row.revenue).toBe(invoice?.summary.totalAmount);
    expect(row.expenses).toBe(4000);
    expect(row.margin).toBe(Math.round((invoice!.summary.totalAmount - 4000) * 100) / 100);
  });

  it('reports firm-wise billed, received, and outstanding totals', async () => {
    const invoiceId = await generateFinalizedInvoice(300);
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoiceId, firmId, amount: 1000, paymentDate: '2026-11-15', paymentMethod: 'cash' });

    const response = await request(app)
      .get('/api/v1/reports/firm-billing?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].firmId).toBe(firmId);
    expect(response.body.data[0].totalReceived).toBe(1000);
    expect(response.body.data[0].totalOutstanding).toBeGreaterThan(0);
  });

  it('summarizes expenses by category for the month', async () => {
    await ExpenseModel.create({ category: 'fuel', date: new Date('2026-11-10'), amount: 1500, description: 'Fuel', createdBy: userId });
    await ExpenseModel.create({ category: 'toll', date: new Date('2026-11-11'), amount: 300, description: 'Toll', createdBy: userId });
    await ExpenseModel.create({ category: 'fuel', date: new Date('2026-11-12'), amount: 500, description: 'Fuel top-up', createdBy: userId });

    const response = await request(app)
      .get('/api/v1/reports/expense-summary?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const fuel = response.body.data.categories.find((row: { category: string }) => row.category === 'fuel');
    expect(fuel.total).toBe(2000);
    expect(response.body.data.grandTotal).toBe(2300);
  });

  it('lists the bill register filtered by firm and status', async () => {
    const invoiceId = await generateFinalizedInvoice(300);

    const response = await request(app)
      .get(`/api/v1/reports/bill-register?firmId=${firmId}&status=finalized`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].invoiceId).toBe(invoiceId);
    expect(response.body.data[0].registrationNumber).toBe('RPT001');
  });

  it('returns a firm receivables report with payment history', async () => {
    const invoiceId = await generateFinalizedInvoice(300);
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoiceId, firmId, amount: 2000, paymentDate: '2026-11-20', paymentMethod: 'bank_transfer' });

    const response = await request(app)
      .get(`/api/v1/reports/firm-receivables/${firmId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.firm.name).toBeDefined();
    expect(response.body.data.invoices).toHaveLength(1);
    expect(response.body.data.payments).toHaveLength(1);
    expect(response.body.data.payments[0].amount).toBe(2000);
    expect(response.body.data.totals.totalReceived).toBe(2000);
  });

  it('reports trip count and total KM per vehicle for the month', async () => {
    await TripModel.create({ tripDate: new Date('2026-11-03T08:00:00.000Z'), vehicleId, driverId, firmId, contractId, contractVersionId, pickupLocation: 'A', dropLocation: 'B', totalKm: 120, operationalStatus: 'completed', toll: { amount: 0 } });
    await TripModel.create({ tripDate: new Date('2026-11-05T08:00:00.000Z'), vehicleId, driverId, firmId, contractId, contractVersionId, pickupLocation: 'A', dropLocation: 'B', totalKm: 180, operationalStatus: 'completed', toll: { amount: 0 } });

    const response = await request(app)
      .get('/api/v1/reports/trip-km?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const row = response.body.data.find((item: { vehicleId: string }) => item.vehicleId === vehicleId);
    expect(row.tripCount).toBe(2);
    expect(row.totalKm).toBe(300);
    expect(row.registrationNumber).toBe('RPT001');
  });

  it('reports actual fuel expense vs billed fuel for the month', async () => {
    await generateFinalizedInvoice(300);
    await ExpenseModel.create({ category: 'fuel', date: new Date('2026-11-06'), amount: 5000, vehicle: vehicleId, description: 'Diesel', createdBy: userId, fuelDetails: { litresPurchased: 50 } });

    const response = await request(app)
      .get('/api/v1/reports/fuel-vs-hsd?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const row = response.body.data.find((item: { vehicleId: string }) => item.vehicleId === vehicleId);
    expect(row.actualFuelSpend).toBe(5000);
    expect(row.litresPurchased).toBe(50);
    expect(row.billedFuelAmount).toBeGreaterThan(0);
    expect(row.variance).toBe(Math.round((row.billedFuelAmount - 5000) * 100) / 100);
  });

  it('reports actual trip toll vs billed toll for the month', async () => {
    await generateFinalizedInvoice(300);

    const response = await request(app)
      .get('/api/v1/reports/toll-variance?month=11&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const row = response.body.data.find((item: { vehicleId: string }) => item.vehicleId === vehicleId);
    expect(row.actualToll).toBe(200);
    expect(row.billedToll).toBeGreaterThan(0);
  });

  it('lists maintenance and service expense history for a vehicle', async () => {
    await ExpenseModel.create({ category: 'maintenance', date: new Date('2026-11-07'), amount: 2200, vehicle: vehicleId, description: 'Brake pad replacement', vendor: 'City Garage', createdBy: userId, maintenanceDetails: { maintenanceType: 'brake_repair', workshopName: 'City Garage' } });
    await ExpenseModel.create({ category: 'fuel', date: new Date('2026-11-08'), amount: 1000, vehicle: vehicleId, description: 'Diesel', createdBy: userId });

    const response = await request(app)
      .get(`/api/v1/reports/maintenance-history?vehicleId=${vehicleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].vendor).toBe('City Garage');
    expect(response.body.data[0].amount).toBe(2200);
  });

  it('reports vehicle document expiry status and days remaining', async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await VehicleDocumentModel.create({ vehicleId, documentType: 'insurance', expiryDate: soon, createdBy: userId });
    await VehicleDocumentModel.create({ vehicleId, documentType: 'permit', expiryDate: past, createdBy: userId });

    const response = await request(app)
      .get(`/api/v1/reports/document-expiry?vehicleId=${vehicleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const insurance = response.body.data.find((row: { documentType: string }) => row.documentType === 'insurance');
    const permit = response.body.data.find((row: { documentType: string }) => row.documentType === 'permit');
    expect(insurance.status).toBe('expiring_soon');
    expect(insurance.isExpired).toBe(false);
    expect(permit.status).toBe('expired');
    expect(permit.isExpired).toBe(true);
  });

  it('reports driver wage summary for a month', async () => {
    await TripModel.create({ tripDate: new Date('2026-11-09T08:00:00.000Z'), vehicleId, driverId, firmId, contractId, contractVersionId, pickupLocation: 'A', dropLocation: 'B', totalKm: 100, operationalStatus: 'completed', toll: { amount: 0 } });
    await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 11, year: 2026 });

    const response = await request(app)
      .get(`/api/v1/reports/driver-wage-summary?driverId=${driverId}&month=11&year=2026`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].daysWorked).toBe(1);
    expect(response.body.data[0].paymentStatus).toBe('pending');
  });
});
