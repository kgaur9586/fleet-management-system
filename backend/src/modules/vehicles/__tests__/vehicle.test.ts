import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { VehicleModel } from '../vehicle.model';
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

  // Seed user and login to get token
  const testUser = {
    name: 'Test Admin',
    email: 'admin@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  };
  await UserModel.create(testUser);

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await VehicleModel.deleteMany({});
});

describe('Vehicle Module', () => {
  const validVehicle = {
    registrationNumber: 'MH 12 AB 1234',
    vehicleType: 'Truck',
    capacity: 10.5,
    make: 'Tata',
    vehicleModel: 'Prima',
  };

  describe('POST /api/v1/vehicles', () => {
    it('should create a vehicle successfully', async () => {
      const response = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehicle);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.registrationNumber).toBe('MH12AB1234'); // Normalized
      expect(response.body.data.vehicleType).toBe(validVehicle.vehicleType);
    });

    it('should not allow duplicate registration numbers', async () => {
      await VehicleModel.create({
        ...validVehicle,
        registrationNumber: 'MH12AB1234'
      });

      const response = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehicle);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already exists/);
    });

    it('should fail validation if registration number contains special characters', async () => {
      const response = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehicle, registrationNumber: 'MH_12@AB!1234' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].message).toMatch(/invalid characters/i);
    });
  });

  describe('GET /api/v1/vehicles', () => {
    it('should list and filter vehicles', async () => {
      await VehicleModel.insertMany([
        { registrationNumber: 'KA01AA1111', vehicleType: 'Truck', capacity: 10, status: 'available' },
        { registrationNumber: 'KA01BB2222', vehicleType: 'Van', capacity: 2, status: 'on_trip' },
        { registrationNumber: 'MH01CC3333', vehicleType: 'Truck', capacity: 12, status: 'maintenance' },
      ]);

      // Filter by status
      const response = await request(app)
        .get('/api/v1/vehicles?status=on_trip')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data.length).toBe(1);
      expect(response.body.data.data[0].registrationNumber).toBe('KA01BB2222');

      // Search by registration number partial
      const searchRes = await request(app)
        .get('/api/v1/vehicles?search=MH01')
        .set('Authorization', `Bearer ${token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.data.length).toBe(1);
      expect(searchRes.body.data.data[0].registrationNumber).toBe('MH01CC3333');
    });
  });

  describe('PATCH /api/v1/vehicles/:id', () => {
    it('should update a vehicle successfully', async () => {
      const vehicle = await VehicleModel.create({
        registrationNumber: 'DL01CC1234',
        vehicleType: 'Truck',
        capacity: 10
      });

      const response = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ capacity: 15, status: 'maintenance' });

      expect(response.status).toBe(200);
      expect(response.body.data.capacity).toBe(15);
      expect(response.body.data.status).toBe('maintenance');
    });
  });

  describe('DELETE /api/v1/vehicles/:id', () => {
    it('should soft delete a vehicle', async () => {
      const vehicle = await VehicleModel.create({
        registrationNumber: 'TS01DD1234',
        vehicleType: 'Truck',
        capacity: 10
      });

      const response = await request(app)
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      // Verify it's soft deleted
      const dbVehicle = await VehicleModel.findById(vehicle._id);
      expect(dbVehicle?.isDeleted).toBe(true);
      expect(dbVehicle?.isActive).toBe(false);

      // Verify it doesn't show up in list
      const listRes = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`);
      
      expect(listRes.body.data.data.length).toBe(0);
    });
  });
});
