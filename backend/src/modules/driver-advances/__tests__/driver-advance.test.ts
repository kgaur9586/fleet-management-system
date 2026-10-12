import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { DriverModel } from '../../drivers/driver.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';
import { DriverAdvanceModel } from '../driver-advance.model';
import { DriverAdvanceRecoveryModel } from '../driver-advance-recovery.model';

let mongoServer: MongoMemoryServer;
let token!: string;
let driverId!: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Advance Owner',
    email: 'advance-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });
  const loginResponse = await request(app).post('/api/v1/auth/login').send({ email: 'advance-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await DriverAdvanceModel.deleteMany({});
  await DriverAdvanceRecoveryModel.deleteMany({});
});

beforeEach(async () => {
  const driver = await DriverModel.create({ name: 'Advance Driver', mobile: `9${Date.now().toString().slice(-9)}`, dailyWage: 600 });
  driverId = String(driver._id);
});

afterEach(async () => {
  await DriverModel.deleteMany({});
});

describe('Driver advances', () => {
  it('creates an advance and rejects a non-positive amount', async () => {
    const created = await request(app).post('/api/v1/driver-advances').set('Authorization', `Bearer ${token}`).send({ driverId, amount: 5000 });
    expect(created.status).toBe(201);
    expect(created.body.data.outstandingAmount).toBeDefined();

    const invalid = await request(app).post('/api/v1/driver-advances').set('Authorization', `Bearer ${token}`).send({ driverId, amount: 0 });
    expect(invalid.status).toBe(400);
  });

  it('lists advances for a driver with outstanding balance', async () => {
    await request(app).post('/api/v1/driver-advances').set('Authorization', `Bearer ${token}`).send({ driverId, amount: 2000 });
    const list = await request(app).get('/api/v1/driver-advances').query({ driverId }).set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.data).toHaveLength(1);

    const outstanding = await request(app).get(`/api/v1/driver-advances/driver/${driverId}/outstanding`).set('Authorization', `Bearer ${token}`);
    expect(outstanding.status).toBe(200);
    expect(outstanding.body.data.outstandingAmount).toBe(2000);
  });
});
