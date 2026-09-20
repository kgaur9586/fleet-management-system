import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { RouteModel } from '../route.model';
import { UserModel } from '../../auth/auth.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';
  await UserModel.create({
    name: 'Test Admin',
    email: 'route-admin@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  });

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'route-admin@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await RouteModel.deleteMany({});
});

describe('Route Module', () => {
  const validRoute = {
    name: 'Delhi to Mumbai',
    routeCode: 'DEL-MUM-001',
    pickupLocation: 'Delhi Depot',
    dropLocation: 'Mumbai Warehouse',
    intermediateStops: ['Jaipur', 'Ahmedabad'],
    expectedDistanceKm: 1_400,
    notes: 'Use the northern checkpoint when available',
  };

  it('creates a reusable route without driver or billing ownership', async () => {
    const response = await request(app)
      .post('/api/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send(validRoute);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject(validRoute);
    expect(response.body.data).not.toHaveProperty('driverId');
    expect(response.body.data).not.toHaveProperty('billingRate');
  });

  it('rejects invalid route fields and pagination values', async () => {
    const invalidResponse = await request(app)
      .post('/api/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validRoute, pickupLocation: ' ' });

    expect(invalidResponse.status).toBe(400);

    const paginationResponse = await request(app)
      .get('/api/v1/routes?page=0&limit=101')
      .set('Authorization', `Bearer ${token}`);

    expect(paginationResponse.status).toBe(400);
  });

  it('prevents duplicate route names and codes', async () => {
    await RouteModel.create(validRoute);

    const response = await request(app)
      .post('/api/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validRoute, name: 'delhi to mumbai', routeCode: 'del-mum-001' });

    expect(response.status).toBe(409);
  });

  it('searches route details, filters status, and paginates results', async () => {
    await RouteModel.insertMany([
      { ...validRoute, isActive: true },
      {
        name: 'Pune to Surat',
        routeCode: 'PUN-SUR-001',
        pickupLocation: 'Pune Depot',
        dropLocation: 'Surat Warehouse',
        intermediateStops: ['Nashik'],
        expectedDistanceKm: 420,
        isActive: false,
        notes: 'Seasonal route',
      },
    ]);

    const searchResponse = await request(app)
      .get('/api/v1/routes?search=checkpoint')
      .set('Authorization', `Bearer ${token}`);

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.data).toHaveLength(1);
    expect(searchResponse.body.data.data[0].name).toBe(validRoute.name);

    const inactiveResponse = await request(app)
      .get('/api/v1/routes?isActive=false&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(inactiveResponse.status).toBe(200);
    expect(inactiveResponse.body.data.data).toHaveLength(1);
    expect(inactiveResponse.body.data.meta).toMatchObject({ total: 1, page: 1, limit: 1, totalPages: 1 });
  });

  it('supports retrieval, update, and soft delete', async () => {
    const route = await RouteModel.create(validRoute);

    const updateResponse = await request(app)
      .patch(`/api/v1/routes/${route._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dropLocation: 'Updated Warehouse', isActive: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.dropLocation).toBe('Updated Warehouse');
    expect(updateResponse.body.data.isActive).toBe(false);

    const deleteResponse = await request(app)
      .delete(`/api/v1/routes/${route._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect((await RouteModel.findById(route._id))?.isDeleted).toBe(true);

    const getResponse = await request(app)
      .get(`/api/v1/routes/${route._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getResponse.status).toBe(404);
  });
});