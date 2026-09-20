import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { ContractModel } from '../contract.model';
import { ContractVersionModel } from '../contract-version.model';
import { FirmModel } from '../../firms/firm.model';
import { UserModel } from '../../auth/auth.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;
let firmId: string;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Contract Admin',
    email: 'contract-admin@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  });
  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'contract-admin@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({ name: 'Contract Test Firm' });
  firmId = String(firm._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await ContractVersionModel.deleteMany({});
  await ContractModel.deleteMany({});
});

const rules = (fuelRatePerLitre: number) => ({
  capacityRates: [{
    capacity: 29000,
    contractualAverageKmPerLitre: 2.5,
    baseHiringRatePerRound: 4500,
    hiringMultiplierRules: [{ minKm: 0, maxKm: 500, multiplier: 1 }],
  }],
  fuelRatePerLitre,
  kmThresholds: [
    { upToKm: 127, rounds: 0.5 },
    { upToKm: 500, rounds: 1 },
    { upToKm: 700, rounds: 1.5 },
    { rounds: 2 },
  ],
  tollTreatment: 'actual',
  otherBillableCharges: [{ code: 'loading', name: 'Loading charge', amount: 100, basis: 'perTrip' }],
});

const createContract = async () => {
  const response = await request(app)
    .post('/api/v1/contracts')
    .set('Authorization', `Bearer ${token}`)
    .send({ firmId, companyId: new mongoose.Types.ObjectId().toString(), name: 'NIR-CFL 2026' });
  expect(response.status).toBe(201);
  return response.body.data;
};

describe('Contracts and Billing Rules Module', () => {
  it('creates and updates a contract, then creates a versioned billing rule set', async () => {
    const contract = await createContract();

    const updateResponse = await request(app)
      .patch(`/api/v1/contracts/${contract._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: '2026 commercial agreement' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.description).toBe('2026 commercial agreement');

    const versionResponse = await request(app)
      .post(`/api/v1/contracts/${contract._id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ effectiveFrom: '2026-01-01T00:00:00.000Z', billingRules: rules(95.81) });

    expect(versionResponse.status).toBe(201);
    expect(versionResponse.body.data.version).toBe(1);
    expect(versionResponse.body.data.billingRules.capacityRates[0].capacity).toBe(29000);
    expect(JSON.stringify(versionResponse.body.data.billingRules.fuelRatePerLitre)).toContain('95.81');
  });

  it('selects the version effective on a trip date and preserves the old version', async () => {
    const contract = await createContract();
    const firstVersion = await ContractVersionModel.create({
      contractId: contract._id,
      version: 1,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-07-01'),
      billingRules: rules(95.81),
    });
    await ContractVersionModel.create({
      contractId: contract._id,
      version: 2,
      effectiveFrom: new Date('2026-07-01'),
      billingRules: rules(102.25),
    });

    const historicalResponse = await request(app)
      .get(`/api/v1/contracts/${contract._id}/versions/effective?date=2026-06-30`)
      .set('Authorization', `Bearer ${token}`);
    const currentResponse = await request(app)
      .get(`/api/v1/contracts/${contract._id}/versions/effective?date=2026-07-01`)
      .set('Authorization', `Bearer ${token}`);

    expect(historicalResponse.status).toBe(200);
    expect(historicalResponse.body.data._id).toBe(String(firstVersion._id));
    expect(JSON.stringify(historicalResponse.body.data.billingRules.fuelRatePerLitre)).toContain('95.81');
    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.data.version).toBe(2);
    expect(JSON.stringify(currentResponse.body.data.billingRules.fuelRatePerLitre)).toContain('102.25');
  });

  it('rejects overlapping versions and invalid rule structures', async () => {
    const contract = await createContract();
    await ContractVersionModel.create({
      contractId: contract._id,
      version: 1,
      effectiveFrom: new Date('2026-01-01'),
      billingRules: rules(95.81),
    });

    const overlapResponse = await request(app)
      .post(`/api/v1/contracts/${contract._id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ effectiveFrom: '2026-06-01', billingRules: rules(102.25) });
    expect(overlapResponse.status).toBe(409);

    const invalidResponse = await request(app)
      .post(`/api/v1/contracts/${contract._id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-12-31',
        billingRules: { ...rules(102.25), capacityRates: [{ ...rules(102.25).capacityRates[0], capacity: 0 }] },
      });
    expect(invalidResponse.status).toBe(400);
  });

  it('does not mutate historical versions through contract deactivation', async () => {
    const contract = await createContract();
    const versionResponse = await request(app)
      .post(`/api/v1/contracts/${contract._id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ effectiveFrom: '2026-01-01', billingRules: rules(95.81) });

    const deleteResponse = await request(app)
      .delete(`/api/v1/contracts/${contract._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteResponse.status).toBe(200);

    const version = await ContractVersionModel.findById(versionResponse.body.data._id);
    expect(version).not.toBeNull();
    expect(version?.billingRules.fuelRatePerLitre.toString()).toContain('95.81');
    expect((await ContractModel.findById(contract._id))?.isActive).toBe(false);
  });
});