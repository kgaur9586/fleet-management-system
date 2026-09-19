import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { FirmModel } from '../firm.model';
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
    email: 'admin_firm@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  };
  await UserModel.create(testUser);

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'admin_firm@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await FirmModel.deleteMany({});
});

describe('Firm Module', () => {
  const validFirm = {
    name: 'Madhusudan Milk Factory',
    billingName: 'Creamy Foods Ltd',
    address: {
      street: 'Industrial Area',
      city: 'Delhi',
    },
    contactDetails: {
      name: 'Manager',
      mobile: '+919876543210',
    },
    gstNumber: '07AAAAA0000A1Z5',
  };

  describe('POST /api/v1/firms', () => {
    it('should create a firm successfully', async () => {
      const response = await request(app)
        .post('/api/v1/firms')
        .set('Authorization', `Bearer ${token}`)
        .send(validFirm);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validFirm.name);
      expect(response.body.data.billingName).toBe(validFirm.billingName);
    });

    it('should fail if firm name is duplicate', async () => {
      await FirmModel.create(validFirm);

      const response = await request(app)
        .post('/api/v1/firms')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validFirm, name: 'madhusudan MILK factory' }); // Case insensitive check

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/already exists/i);
    });
  });

  describe('GET /api/v1/firms', () => {
    it('should list and search firms', async () => {
      await FirmModel.insertMany([
        { name: 'Madhusudan Milk Factory', gstNumber: '07GST123' },
        { name: 'Neeraj Kumar Gupta', gstNumber: '07GST456' },
      ]);

      const res = await request(app)
        .get('/api/v1/firms?search=Neeraj')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].name).toBe('Neeraj Kumar Gupta');
    });
  });

  describe('PATCH /api/v1/firms/:id', () => {
    it('should update firm successfully', async () => {
      const firm = await FirmModel.create(validFirm);

      const response = await request(app)
        .patch(`/api/v1/firms/${firm._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ address: { ...validFirm.address, city: 'Mumbai' }, isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.data.address.city).toBe('Mumbai');
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/firms/:id', () => {
    it('should soft delete firm', async () => {
      const firm = await FirmModel.create(validFirm);

      const response = await request(app)
        .delete(`/api/v1/firms/${firm._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      const dbFirm = await FirmModel.findById(firm._id);
      expect(dbFirm?.isDeleted).toBe(true);
      expect(dbFirm?.isActive).toBe(false);
    });
  });
});
