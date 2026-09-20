import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { VehicleDocumentModel } from '../vehicle-document.model';
import { getVehicleDocumentStatus } from '../vehicle-document.status';
import { LocalObjectStorage } from '../storage/local-object-storage';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;
let vehicleId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Document Owner',
    email: 'document-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });
  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'document-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({ name: 'Document Test Firm' });
  const vehicle = await VehicleModel.create({
    registrationNumber: 'KA01DOC001',
    vehicleType: 'truck',
    capacity: 29000,
    firmId: firm._id,
  });
  vehicleId = String((vehicle as any)._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await VehicleDocumentModel.deleteMany({});
});

describe('Vehicle document management', () => {
  it('classifies active, expiring soon, and expired documents', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    expect(getVehicleDocumentStatus(new Date('2026-09-19'), now)).toBe('expired');
    expect(getVehicleDocumentStatus(new Date('2026-10-01'), now)).toBe('expiring_soon');
    expect(getVehicleDocumentStatus(new Date('2027-01-01'), now)).toBe('active');
  });

  it('validates metadata, stores a file reference, and filters expiry status', async () => {
    const issueDate = new Date('2026-01-01T00:00:00.000Z');
    const expired = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ vehicleId, documentType: 'rc', documentNumber: 'RC-001', issueDate, expiryDate: '2026-01-01', fileReference: 's3://bucket/rc-001.pdf' });
    expect(expired.status).toBe(201);
    expect(expired.body.data.status).toBe('expired');

    const invalid = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ vehicleId, documentType: 'insurance', issueDate: '2026-10-01', expiryDate: '2026-09-01' });
    expect(invalid.status).toBe(400);

    const expiredList = await request(app)
      .get('/api/v1/documents')
      .query({ vehicleId, status: 'expired' })
      .set('Authorization', `Bearer ${token}`);
    expect(expiredList.status).toBe(200);
    expect(expiredList.body.data.data).toHaveLength(1);
    expect(expiredList.body.data.data[0].fileReference).toBe('s3://bucket/rc-001.pdf');
  });

  it('uploads through local storage without storing binary content in MongoDB and protects file access', async () => {
    const response = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('vehicleId', vehicleId)
      .field('documentType', 'pollution')
      .field('documentNumber', 'PUC-001')
      .field('issueDate', '2026-01-01')
      .field('expiryDate', '2027-01-01')
      .attach('file', Buffer.from('vehicle document test'), 'pollution.pdf');

    expect(response.status).toBe(201);
    expect(response.body.data.fileReference).toMatch(/^local\//);
    expect(response.body.data).not.toHaveProperty('fileContent');

    const stored = await VehicleDocumentModel.findById(response.body.data._id).lean();
    expect(stored?.fileReference).toBe(response.body.data.fileReference);
    expect(stored).not.toHaveProperty('fileContent');

    const download = await request(app)
      .get(`/api/v1/documents/${response.body.data._id}/file`)
      .set('Authorization', `Bearer ${token}`);
    expect(download.status).toBe(200);
    expect(download.body.toString()).toBe('vehicle document test');

    const storage = new LocalObjectStorage();
    await storage.delete(response.body.data.fileReference);
    await expect(fs.access(path.resolve(process.cwd(), 'storage', 'vehicle-documents'))).resolves.toBeUndefined();
  });
});
