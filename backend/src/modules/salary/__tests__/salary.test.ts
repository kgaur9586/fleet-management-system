import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { DriverModel } from '../../drivers/driver.model';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { ContractModel } from '../../contracts/contract.model';
import { ContractVersionModel } from '../../contracts/contract-version.model';
import { TripModel } from '../../trips/trip.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';
import { SalaryRecordModel } from '../salary-record.model';
import { DriverAdvanceModel } from '../../driver-advances/driver-advance.model';
import { DriverAdvanceRecoveryModel } from '../../driver-advances/driver-advance-recovery.model';

let mongoServer: MongoMemoryServer;
let token!: string;
let vehicleId!: string;
let firmId!: string;
let contractId!: string;
let contractVersionId!: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Salary Owner',
    email: 'salary-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });
  const loginResponse = await request(app).post('/api/v1/auth/login').send({ email: 'salary-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({ name: 'Salary Test Firm' });
  firmId = String(firm._id);
  const vehicle = await VehicleModel.create({ registrationNumber: 'SAL001', vehicleType: 'Truck', capacity: 29000, firmId: firm._id });
  vehicleId = String(vehicle._id);
  const contract = await ContractModel.create({ firmId: firm._id, name: 'Salary Contract' });
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
  await SalaryRecordModel.deleteMany({});
  await DriverAdvanceModel.deleteMany({});
  await DriverAdvanceRecoveryModel.deleteMany({});
  await TripModel.deleteMany({});
  await DriverModel.deleteMany({});
});

const createDriver = (dailyWage: number) => DriverModel.create({ name: 'Salary Driver', mobile: `9${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 9)}`, dailyWage });

const createTrip = (driverId: string, isoDate: string) => TripModel.create({
  tripDate: new Date(isoDate),
  vehicleId, driverId, firmId, contractId, contractVersionId,
  pickupLocation: 'A', dropLocation: 'B', totalKm: 100,
  toll: { amount: 0 },
  operationalStatus: 'completed',
});

// Handles both JSON-serialized Decimal128 ({ $numberDecimal: "..." }) and raw lean() documents.
const decimalNumber = (value: unknown): number => {
  if (typeof value === 'object' && value !== null && '$numberDecimal' in (value as Record<string, unknown>)) {
    return Number((value as { $numberDecimal: string }).$numberDecimal);
  }
  if (value && typeof (value as { toString?: unknown }).toString === 'function') return Number(String(value));
  return Number(value);
};

describe('Driver salary generation', () => {
  it('counts one wage per distinct worked day regardless of trip count, using a single monthly rate', async () => {
    const driver = await createDriver(700);
    const driverId = String(driver._id);
    // Two trips on the same day must count once; a third trip on a different day adds one more day.
    await createTrip(driverId, '2026-06-01T08:00:00.000Z');
    await createTrip(driverId, '2026-06-01T18:00:00.000Z');
    await createTrip(driverId, '2026-06-05T08:00:00.000Z');

    const generated = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 6, year: 2026 });

    expect(generated.status).toBe(201);
    expect(generated.body.data.daysWorked).toBe(2);
    expect(decimalNumber(generated.body.data.dailyWageRate)).toBe(700);
    expect(decimalNumber(generated.body.data.grossWages)).toBe(1400);
    expect(decimalNumber(generated.body.data.netPayable)).toBe(1400);

    const duplicate = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 6, year: 2026 });
    expect(duplicate.status).toBe(409);
  });

  it('caps an owner-entered deduction at the outstanding advance balance and carries the remainder forward', async () => {
    const driver = await createDriver(1000);
    const driverId = String(driver._id);
    await createTrip(driverId, '2026-07-01T08:00:00.000Z');
    await createTrip(driverId, '2026-07-02T08:00:00.000Z');

    await request(app).post('/api/v1/driver-advances').set('Authorization', `Bearer ${token}`).send({ driverId, amount: 1200 });

    const generated = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 7, year: 2026 });
    expect(decimalNumber(generated.body.data.grossWages)).toBe(2000);
    const salaryId = generated.body.data._id;

    // Owner asks to deduct more than is outstanding on the advance.
    const deduction = await request(app).patch(`/api/v1/salary/${salaryId}/deduction`).set('Authorization', `Bearer ${token}`).send({ amount: 5000 });
    expect(deduction.status).toBe(200);
    expect(deduction.body.data.deduction.requested).toBe(5000);
    expect(deduction.body.data.deduction.applied).toBe(1200);
    expect(deduction.body.data.deduction.carriedForward).toBe(3800);
    expect(decimalNumber(deduction.body.data.record.netPayable)).toBe(800);

    const outstanding = await request(app).get(`/api/v1/driver-advances/driver/${driverId}/outstanding`).set('Authorization', `Bearer ${token}`);
    expect(outstanding.body.data.outstandingAmount).toBe(0);
  });

  it('re-entering a deduction amount replaces the previous application instead of stacking it', async () => {
    const driver = await createDriver(1000);
    const driverId = String(driver._id);
    await createTrip(driverId, '2026-08-01T08:00:00.000Z');
    await createTrip(driverId, '2026-08-02T08:00:00.000Z');
    await createTrip(driverId, '2026-08-03T08:00:00.000Z');

    await request(app).post('/api/v1/driver-advances').set('Authorization', `Bearer ${token}`).send({ driverId, amount: 2500 });
    const generated = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 8, year: 2026 });
    const salaryId = generated.body.data._id;

    await request(app).patch(`/api/v1/salary/${salaryId}/deduction`).set('Authorization', `Bearer ${token}`).send({ amount: 1000 });
    let outstanding = await request(app).get(`/api/v1/driver-advances/driver/${driverId}/outstanding`).set('Authorization', `Bearer ${token}`);
    expect(outstanding.body.data.outstandingAmount).toBe(1500);

    const second = await request(app).patch(`/api/v1/salary/${salaryId}/deduction`).set('Authorization', `Bearer ${token}`).send({ amount: 600 });
    expect(second.body.data.deduction.applied).toBe(600);

    outstanding = await request(app).get(`/api/v1/driver-advances/driver/${driverId}/outstanding`).set('Authorization', `Bearer ${token}`);
    expect(outstanding.body.data.outstandingAmount).toBe(1900);

    const record = await SalaryRecordModel.findById(salaryId).lean();
    expect(decimalNumber(record?.advanceDeduction)).toBe(600);
  });

  it('sets a flat other-deductions amount, replacing rather than stacking on re-entry', async () => {
    const driver = await createDriver(1000);
    const driverId = String(driver._id);
    await createTrip(driverId, '2026-10-01T08:00:00.000Z');
    await createTrip(driverId, '2026-10-02T08:00:00.000Z');

    const generated = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 10, year: 2026 });
    const salaryId = generated.body.data._id;
    expect(decimalNumber(generated.body.data.grossWages)).toBe(2000);

    const first = await request(app).patch(`/api/v1/salary/${salaryId}/other-deductions`).set('Authorization', `Bearer ${token}`).send({ amount: 150 });
    expect(first.status).toBe(200);
    expect(decimalNumber(first.body.data.otherDeductions)).toBe(150);
    expect(decimalNumber(first.body.data.netPayable)).toBe(1850);

    const second = await request(app).patch(`/api/v1/salary/${salaryId}/other-deductions`).set('Authorization', `Bearer ${token}`).send({ amount: 300 });
    expect(decimalNumber(second.body.data.otherDeductions)).toBe(300);
    expect(decimalNumber(second.body.data.netPayable)).toBe(1700);

    const tooLarge = await request(app).patch(`/api/v1/salary/${salaryId}/other-deductions`).set('Authorization', `Bearer ${token}`).send({ amount: 5000 });
    expect(tooLarge.status).toBe(400);

    const paid = await request(app).patch(`/api/v1/salary/${salaryId}/mark-paid`).set('Authorization', `Bearer ${token}`).send({ paymentMode: 'cash' });
    expect(paid.status).toBe(200);

    const blocked = await request(app).patch(`/api/v1/salary/${salaryId}/other-deductions`).set('Authorization', `Bearer ${token}`).send({ amount: 50 });
    expect(blocked.status).toBe(409);
  });

  it('marks a record as paid and blocks further deduction changes', async () => {
    const driver = await createDriver(500);
    const driverId = String(driver._id);
    await createTrip(driverId, '2026-09-01T08:00:00.000Z');
    const generated = await request(app).post('/api/v1/salary/generate').set('Authorization', `Bearer ${token}`).send({ driverId, month: 9, year: 2026 });
    const salaryId = generated.body.data._id;

    const paid = await request(app).patch(`/api/v1/salary/${salaryId}/mark-paid`).set('Authorization', `Bearer ${token}`).send({ paymentMode: 'cash' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.paymentStatus).toBe('paid');

    const repeat = await request(app).patch(`/api/v1/salary/${salaryId}/mark-paid`).set('Authorization', `Bearer ${token}`).send({ paymentMode: 'cash' });
    expect(repeat.status).toBe(409);

    const blockedDeduction = await request(app).patch(`/api/v1/salary/${salaryId}/deduction`).set('Authorization', `Bearer ${token}`).send({ amount: 100 });
    expect(blockedDeduction.status).toBe(409);
  });
});
