import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { FirmModel } from '../../firms/firm.model';
import { InvoiceModel } from '../../invoices/invoice.model';
import { PaymentModel } from '../payment.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  await UserModel.create({
    name: 'Payment Owner',
    email: 'payment-owner@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'owner',
  });

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'payment-owner@test.com', password: 'password123' });
  token = loginResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await PaymentModel.deleteMany({});
  await InvoiceModel.deleteMany({});
  await FirmModel.deleteMany({});
});

const createFinalizedInvoice = async () => {
  const firm = await FirmModel.create({ name: 'Payment Test Firm', billingName: 'Payment Customer' });
  const invoice = await InvoiceModel.create({
    firmId: firm._id,
    vehicleId: new mongoose.Types.ObjectId(),
    month: 2,
    year: 2026,
    invoiceNumber: 'INV-PAYMENT-001',
    status: 'finalized',
    generatedBy: new mongoose.Types.ObjectId(),
    finalizedBy: new mongoose.Types.ObjectId(),
    generatedAt: new Date('2026-02-28T10:00:00.000Z'),
    finalizedAt: new Date('2026-03-01T10:00:00.000Z'),
    companySnapshot: { name: 'Fleet Company' },
    firmSnapshot: { name: firm.name },
    vehicleSnapshot: { registrationNumber: 'KA01AA0001', capacity: 29000 },
    lineItems: [],
    summary: {
      tripCount: 2,
      fuelAmount: 1000,
      hiringAmount: 7000,
      tollAmount: 500,
      otherBillableAmount: 0,
      totalAmount: 8500,
    },
  });
  return { firm, invoice };
};

describe('Customer payment tracking', () => {
  it('records a payment, reports received and outstanding totals, and reconciles the invoice', async () => {
    const { firm, invoice } = await createFinalizedInvoice();

    const createResponse = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceId: String(invoice._id),
        firmId: String(firm._id),
        amount: 3000,
        paymentDate: '2026-03-10',
        paymentMethod: 'bank_transfer',
        referenceNumber: 'UTR-12345',
        status: 'received',
        notes: 'February settlement part payment',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.amount).toBe(3000);
    expect(createResponse.body.data.referenceNumber).toBe('UTR-12345');

    const summaryResponse = await request(app)
      .get('/api/v1/payments/summary')
      .query({ firmId: String(firm._id), month: 2, year: 2026 })
      .set('Authorization', `Bearer ${token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totalInvoiced).toBe(8500);
    expect(summaryResponse.body.data.totalReceived).toBe(3000);
    expect(summaryResponse.body.data.outstandingAmount).toBe(5500);

    const historyResponse = await request(app)
      .get('/api/v1/payments')
      .query({ invoiceId: String(invoice._id) })
      .set('Authorization', `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.data).toHaveLength(1);
    expect(historyResponse.body.data.data[0].paymentMethod).toBe('bank_transfer');

    const after = await InvoiceModel.findById(invoice._id).lean();
    expect(after?.totalPaid).toBe(3000);
    expect(after?.outstandingAmount).toBe(5500);
    expect(after?.paymentStatus).toBe('partially_paid');
  });

  it('blocks payments that cumulatively exceed the invoice total', async () => {
    const { firm, invoice } = await createFinalizedInvoice();
    const post = (amount: number) =>
      request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceId: String(invoice._id),
          firmId: String(firm._id),
          amount,
          paymentDate: '2026-03-10',
          paymentMethod: 'cash',
          status: 'received',
        });

    expect((await post(5000)).status).toBe(201);
    expect((await post(3500)).status).toBe(201);

    const overpayment = await post(1);
    expect(overpayment.status).toBe(409);

    const settled = await InvoiceModel.findById(invoice._id).lean();
    expect(settled?.totalPaid).toBe(8500);
    expect(settled?.outstandingAmount).toBe(0);
    expect(settled?.paymentStatus).toBe('paid');
  });

  it('rejects payments against non-finalized invoices and overpayments', async () => {
    const { firm } = await createFinalizedInvoice();
    const draft = await InvoiceModel.create({
      firmId: firm._id,
      vehicleId: new mongoose.Types.ObjectId(),
      month: 3,
      year: 2026,
      invoiceNumber: 'INV-PAYMENT-002',
      status: 'draft',
      generatedBy: new mongoose.Types.ObjectId(),
      companySnapshot: { name: 'Fleet Company' },
      firmSnapshot: { name: firm.name },
      vehicleSnapshot: { registrationNumber: 'KA01AA0002', capacity: 29000 },
      summary: { tripCount: 0, fuelAmount: 0, hiringAmount: 0, tollAmount: 0, otherBillableAmount: 0, totalAmount: 1000 },
    });

    const draftResponse = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceId: String(draft._id),
        firmId: String(firm._id),
        amount: 500,
        paymentDate: '2026-03-10',
        paymentMethod: 'cash',
      });
    expect(draftResponse.status).toBe(409);

    const overpaymentResponse = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceId: String((await InvoiceModel.findOne({ status: 'finalized' }))?._id),
        firmId: String(firm._id),
        amount: 8501,
        paymentDate: '2026-03-10',
        paymentMethod: 'cash',
      });
    expect(overpaymentResponse.status).toBe(409);
  });
});
