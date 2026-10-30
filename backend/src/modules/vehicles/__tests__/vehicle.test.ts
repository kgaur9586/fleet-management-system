import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { VehicleModel } from '../vehicle.model';
import { TripModel } from '../../trips/trip.model';
import { removeVehicleHiringCharges } from '../../../../scripts/remove-vehicle-hiring-charges';
import { UserModel } from '../../auth/auth.model';
import { AuditLogModel } from '../../audit/audit-log.model';
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

    it('stores optional operational rates and audits their initial configuration', async () => {
      const response = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validVehicle,
          registrationNumber: 'UP14XY2026',
          operationalRates: {
            averageKmPerLitre: 2.2,
            fuelRatePerLitre: 98.5,
            effectiveFrom: '2026-06-01T00:00:00.000Z',
          },
        });

      expect(response.status).toBe(201);
      const vehicleId = response.body.data._id;
      const stored = await VehicleModel.findById(vehicleId);
      expect(stored?.operationalRates).not.toHaveProperty('hiringChargePerRound');
      expect(stored?.operationalRates?.averageKmPerLitre.toString()).toBe('2.2');
      expect(stored?.operationalRates?.fuelRatePerLitre?.toString()).toBe('98.5');

      const audit = await AuditLogModel.findOne({
        action: 'vehicle.operational_rates_updated',
        entityId: vehicleId,
      });
      expect(audit?.userId?.toString()).toBeDefined();
      expect(audit?.changes?.after).toMatchObject({ averageKmPerLitre: '2.2' });
      expect(audit?.changes?.after).not.toHaveProperty('hiringChargePerRound');
    });

    it('rejects zero or negative operational rates', async () => {
      const response = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validVehicle,
          operationalRates: {
            averageKmPerLitre: 0,
            effectiveFrom: '2026-06-01T00:00:00.000Z',
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].path).toContain('operationalRates.averageKmPerLitre');
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

    it('audits operational-rate changes with before and after values', async () => {
      const vehicle = await VehicleModel.create({
        registrationNumber: 'DL01CC5678',
        vehicleType: 'Truck',
        capacity: 10,
        operationalRates: {
          averageKmPerLitre: 2.5,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      const response = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ operationalRates: {
          averageKmPerLitre: 2.4,
          effectiveFrom: '2026-07-01T00:00:00.000Z',
        } });

      expect(response.status).toBe(200);
      const audit = await AuditLogModel.findOne({
        action: 'vehicle.operational_rates_updated',
        entityId: vehicle._id,
      }).sort({ timestamp: -1 });
      expect(audit?.changes?.before).toMatchObject({ averageKmPerLitre: '2.5' });
      expect(audit?.changes?.after).toMatchObject({ averageKmPerLitre: '2.4' });
      expect(audit?.changes?.after).not.toHaveProperty('hiringChargePerRound');
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

  describe('removeVehicleHiringCharges', () => {
    it('unsets the vehicle hiring charge without changing trips', async () => {
      const vehicle = await VehicleModel.create({
        registrationNumber: 'SCRIPT0001',
        vehicleType: 'Truck',
        capacity: 10,
        operationalRates: { averageKmPerLitre: 2.2, effectiveFrom: new Date('2026-01-01T00:00:00.000Z') },
      });
      await VehicleModel.collection.updateOne(
        { _id: vehicle._id },
        { $set: { 'operationalRates.hiringChargePerRound': mongoose.Types.Decimal128.fromString('5200') } },
      );
      const trip = await TripModel.collection.insertOne({
        vehicleId: vehicle._id,
        hiringChargePerRound: mongoose.Types.Decimal128.fromString('3000'),
        rateSnapshot: { hiringChargePerRound: '3000' },
      });

      const result = await removeVehicleHiringCharges();
      const stored = await VehicleModel.collection.findOne({ _id: vehicle._id });
      const storedTrip = await TripModel.collection.findOne({ _id: trip.insertedId });

      expect(result.modified).toBeGreaterThanOrEqual(1);
      expect(stored?.operationalRates).not.toHaveProperty('hiringChargePerRound');
      expect(String(stored?.operationalRates?.averageKmPerLitre)).toBe('2.2');
      expect(String(storedTrip?.hiringChargePerRound)).toBe('3000');
      expect(storedTrip?.rateSnapshot?.hiringChargePerRound).toBe('3000');

      await removeVehicleHiringCharges();
      const rerun = await VehicleModel.collection.findOne({ _id: vehicle._id });
      expect(rerun?.operationalRates).not.toHaveProperty('hiringChargePerRound');
      await TripModel.collection.deleteOne({ _id: trip.insertedId });
    });
  });
});
