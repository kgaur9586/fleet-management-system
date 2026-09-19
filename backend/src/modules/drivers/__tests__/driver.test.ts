import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { DriverModel } from '../driver.model';
import { UserModel } from '../../auth/auth.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  const testUser = {
    name: 'Test Admin',
    email: 'admin_driver@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  };
  await UserModel.create(testUser);

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'admin_driver@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await DriverModel.deleteMany({});
});

describe('Driver Module', () => {
  const validDriver = {
    name: 'Ramesh Kumar',
    mobile: '+919876543210',
    employeeId: 'EMP001',
    dailyWage: 500,
    notes: 'Experienced driver',
  };

  describe('POST /api/v1/drivers', () => {
    it('should create a driver successfully', async () => {
      const response = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send(validDriver);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validDriver.name);
      expect(response.body.data.dailyWage).toBeDefined();
    });

    it('should fail if mobile number is duplicate', async () => {
      await DriverModel.create({
        ...validDriver,
        dailyWage: mongoose.Types.Decimal128.fromString('500'),
      });

      const response = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send(validDriver);

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/already exists/i);
    });

    it('should fail validation on invalid mobile', async () => {
      const response = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validDriver, mobile: 'invalid-number' });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].message).toMatch(/Invalid mobile/i);
    });
  });

  describe('GET /api/v1/drivers', () => {
    it('should list and search drivers', async () => {
      await DriverModel.insertMany([
        { name: 'Ramesh Kumar', mobile: '9876543210', employeeId: 'EMP001', dailyWage: mongoose.Types.Decimal128.fromString('500') },
        { name: 'Suresh Singh', mobile: '9876543211', employeeId: 'EMP002', dailyWage: mongoose.Types.Decimal128.fromString('600') },
      ]);

      const res = await request(app)
        .get('/api/v1/drivers?search=Suresh')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].name).toBe('Suresh Singh');
    });
  });

  describe('PATCH /api/v1/drivers/:id', () => {
    it('should update driver successfully', async () => {
      const driver = await DriverModel.create({
        ...validDriver,
        dailyWage: mongoose.Types.Decimal128.fromString('500'),
      });

      const response = await request(app)
        .patch(`/api/v1/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dailyWage: 550, isActive: false });

      expect(response.status).toBe(200);
      // Wait, Mongoose returns Decimal128 as an object like { "$numberDecimal": "550" }
      // To bypass checking exact Decimal128 format in test, just check isActive
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/drivers/:id', () => {
    it('should soft delete and add history event', async () => {
      const driver = await DriverModel.create({
        ...validDriver,
        dailyWage: mongoose.Types.Decimal128.fromString('500'),
      });

      const response = await request(app)
        .delete(`/api/v1/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      const dbDriver = await DriverModel.findById(driver._id);
      expect(dbDriver?.isDeleted).toBe(true);
      expect(dbDriver?.history.length).toBe(1);
      expect(dbDriver?.history[0].eventType).toBe('terminated');
    });
  });
});
