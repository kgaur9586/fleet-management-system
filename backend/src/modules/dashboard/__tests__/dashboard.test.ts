import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { env } from '../../../config/env';
import { hashPassword } from '../../../utils/hash';
import { UserModel } from '../../auth/auth.model';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { DriverModel } from '../../drivers/driver.model';
import { TripModel } from '../../trips/trip.model';
import { InvoiceModel } from '../../invoices/invoice.model';
import { PaymentModel } from '../../payments/payment.model';
import { ExpenseModel } from '../../expenses/expense.model';
import { VehicleDocumentModel } from '../../documents/vehicle-document.model';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';
  await UserModel.create({ name: 'Dashboard Owner', email: 'dashboard@test.com', passwordHash: await hashPassword('password123'), role: 'owner' });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'dashboard@test.com', password: 'password123' });
  token = login.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([
    VehicleDocumentModel.deleteMany({}), ExpenseModel.deleteMany({}), PaymentModel.deleteMany({}), InvoiceModel.deleteMany({}), TripModel.deleteMany({}), DriverModel.deleteMany({}), VehicleModel.deleteMany({}), FirmModel.deleteMany({}),
  ]);
});

test('returns operational, financial, vehicle, and document alert metrics for a billing month', async () => {
  const firm = await FirmModel.create({ name: 'Dashboard Firm' });
  const vehicle = await VehicleModel.create({ registrationNumber: 'KA01DASH01', vehicleType: 'truck', capacity: 29000, firmId: firm._id, isActive: true });
  const inactiveVehicle = await VehicleModel.create({ registrationNumber: 'KA01DASH02', vehicleType: 'truck', capacity: 29000, firmId: firm._id, isActive: false });
  const driver = await DriverModel.create({ name: 'Dashboard Driver', mobile: '9000000001', dailyWage: 1000 });
  const invoice = await InvoiceModel.create({
    firmId: firm._id, vehicleId: vehicle._id, month: 9, year: 2026, invoiceNumber: 'INV-DASH-001', status: 'finalized', generatedBy: new mongoose.Types.ObjectId(),
    companySnapshot: { name: 'Company' }, firmSnapshot: { name: firm.name }, vehicleSnapshot: { registrationNumber: vehicle.registrationNumber, capacity: vehicle.capacity },
    lineItems: [{
      tripId: new mongoose.Types.ObjectId(), vehicleId: vehicle._id, driverId: driver._id, contractId: new mongoose.Types.ObjectId(), contractVersionId: new mongoose.Types.ObjectId(),
      tripSnapshot: { tripDate: new Date('2026-09-12'), pickupLocation: 'A', dropLocation: 'B', distanceKm: '100', tollAmount: '0' },
      vehicleSnapshot: { registrationNumber: vehicle.registrationNumber, capacity: vehicle.capacity },
      snapshot: { distanceKm: '100', contractualAverage: '2.5', fuelLitres: '40', fuelRate: '95.81', fuelAmount: '100', hiringMultiplier: '1', baseHiringRate: '900', hiringAmount: '900', tollAmount: '0', otherBillableAmount: '0', totalAmount: '1000', contractId: 'contract', contractVersionId: 'version', vehicleCapacity: 29000, rounding: { monetaryScale: 2, monetaryMode: 'ROUND_HALF_UP', intermediateValuesRounded: false } },
    }],
    summary: { tripCount: 1, fuelAmount: 100, hiringAmount: 900, tollAmount: 0, otherBillableAmount: 0, totalAmount: 1000 },
  });
  await PaymentModel.create({ invoiceId: invoice._id, firmId: firm._id, amount: 400, paymentDate: new Date('2026-09-15'), paymentMethod: 'bank_transfer', status: 'received', createdBy: new mongoose.Types.ObjectId() });
  await ExpenseModel.create({ category: 'maintenance', date: new Date('2026-09-12'), amount: 250, vehicle: vehicle._id, description: 'Dashboard repair', createdBy: new mongoose.Types.ObjectId() });
  await VehicleDocumentModel.create({ vehicleId: vehicle._id, documentType: 'insurance', issueDate: new Date('2026-01-01'), expiryDate: new Date('2026-10-01'), fileReference: 's3/insurance.pdf', createdBy: new mongoose.Types.ObjectId() });
  await VehicleDocumentModel.create({ vehicleId: inactiveVehicle._id, documentType: 'permit', expiryDate: new Date('2026-08-01'), createdBy: new mongoose.Types.ObjectId() });
  await TripModel.create({ tripDate: new Date(), vehicleId: vehicle._id, driverId: driver._id, firmId: firm._id, contractId: new mongoose.Types.ObjectId(), contractVersionId: new mongoose.Types.ObjectId(), pickupLocation: 'A', dropLocation: 'B', totalKm: 100, operationalStatus: 'completed', toll: { amount: 0 } });

  const response = await request(app).get('/api/v1/dashboard').query({ month: 9, year: 2026 }).set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.fleet).toMatchObject({ totalVehicles: 2, activeVehicles: 1, inactiveVehicles: 1, totalDrivers: 1 });
  expect(response.body.data.operations.tripsThisMonth).toBe(1);
  expect(response.body.data.finance).toMatchObject({ monthlyBilling: 1000, monthlyPaymentsReceived: 400, monthlyExpenses: 250 });
  expect(response.body.data.finance.outstandingInvoices).toMatchObject({ count: 1, amount: 600 });
  expect(response.body.data.vehicleBilling[0]).toMatchObject({ total: 1000, totalTrips: 1, totalKm: 100, contractualFuelQuantity: 40, registrationNumber: 'KA01DASH01' });
  expect(response.body.data.vehicleExpenses[0]).toMatchObject({ total: 250, registrationNumber: 'KA01DASH01' });
  expect(response.body.data.documentAlerts.expiringSoon).toHaveLength(1);
  expect(response.body.data.documentAlerts.expired).toHaveLength(1);
});
