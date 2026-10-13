import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';
import { HsdRateModel } from '../hsd-rate.model';

let mongoServer: MongoMemoryServer;
let token!: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({ name: 'HSD Owner', email: 'hsd-owner@test.com', passwordHash: await hashPassword('password123'), role: 'owner' });
  const loginResponse = await request(app).post('/api/v1/auth/login').send({ email: 'hsd-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await HsdRateModel.deleteMany({});
});

describe('Global HSD rate', () => {
  it('rejects a duplicate effective date and lists rates newest first', async () => {
    await request(app).post('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`).send({ ratePerLitre: 95.81, effectiveFrom: '2026-01-01T00:00:00.000Z' });
    const duplicate = await request(app).post('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`).send({ ratePerLitre: 100, effectiveFrom: '2026-01-01T00:00:00.000Z' });
    expect(duplicate.status).toBe(409);

    await request(app).post('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`).send({ ratePerLitre: 102.25, effectiveFrom: '2026-07-01T00:00:00.000Z' });
    const list = await request(app).get('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.data).toHaveLength(2);
    expect(Number(list.body.data.data[0].ratePerLitre.$numberDecimal ?? list.body.data.data[0].ratePerLitre)).toBe(102.25);
  });

  it('resolves the rate effective on a given date without needing an explicit effectiveTo', async () => {
    await request(app).post('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`).send({ ratePerLitre: 95.81, effectiveFrom: '2026-01-01T00:00:00.000Z' });
    await request(app).post('/api/v1/hsd-rates').set('Authorization', `Bearer ${token}`).send({ ratePerLitre: 102.25, effectiveFrom: '2026-07-01T00:00:00.000Z' });

    const beforeChange = await request(app).get('/api/v1/hsd-rates/effective').query({ date: '2026-06-30T00:00:00.000Z' }).set('Authorization', `Bearer ${token}`);
    expect(Number(beforeChange.body.data.ratePerLitre.$numberDecimal)).toBe(95.81);

    const onChangeDay = await request(app).get('/api/v1/hsd-rates/effective').query({ date: '2026-07-01T00:00:00.000Z' }).set('Authorization', `Bearer ${token}`);
    expect(Number(onChangeDay.body.data.ratePerLitre.$numberDecimal)).toBe(102.25);
  });
});
