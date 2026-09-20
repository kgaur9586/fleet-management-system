import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import { UserModel } from '../../auth/auth.model';
import { FirmModel } from '../../firms/firm.model';
import { VehicleModel } from '../../vehicles/vehicle.model';
import { ExpenseModel } from '../expense.model';
import { hashPassword } from '../../../utils/hash';
import { env } from '../../../config/env';

let mongoServer: MongoMemoryServer;
let token: string;
let firmId: mongoose.Types.ObjectId;
let vehicleId: mongoose.Types.ObjectId;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  env.JWT_SECRET = 'test_secret_key_needs_to_be_long_enough';

  const testUser = {
    name: 'Test Admin',
    email: 'admin_expense@test.com',
    passwordHash: await hashPassword('password123'),
    role: 'admin',
  };
  await UserModel.create(testUser);

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'admin_expense@test.com',
    password: 'password123',
  });
  token = loginResponse.body.data.token;

  const firm = await FirmModel.create({
    name: 'Expense Test Firm',
    billingName: 'Expense Test Firm',
    isActive: true,
  });
  firmId = firm._id as mongoose.Types.ObjectId;

  const vehicle = await VehicleModel.create({
    registrationNumber: 'EXP-1001',
    vehicleType: 'Truck',
    capacity: 12,
    firmId,
    status: 'available',
  });
  vehicleId = vehicle._id as mongoose.Types.ObjectId;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await ExpenseModel.deleteMany({});
});

describe('Expense Module', () => {
  it('should create a fuel expense successfully', async () => {
    const response = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'fuel',
        date: '2026-05-14',
        amount: 4850,
        vehicleId,
        firmId,
        vendor: 'Indian Oil',
        description: 'Fuel top-up for vehicle',
        fuelDetails: {
          litresPurchased: 120,
          ratePerLitre: 40.42,
          pumpName: 'Indian Oil, Hubballi',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.category).toBe('fuel');
    expect(response.body.data.amount).toBe(4850);
  });

  it('should list and filter expenses by category and date range', async () => {
    await ExpenseModel.insertMany([
      {
        category: 'fuel',
        date: new Date('2026-05-10'),
        amount: 3000,
        vehicle: vehicleId,
        firm: firmId,
        vendor: 'BPCL',
        description: 'Fuel for route 1',
        createdBy: new mongoose.Types.ObjectId(),
      },
      {
        category: 'maintenance',
        date: new Date('2026-05-12'),
        amount: 5200,
        vehicle: vehicleId,
        firm: firmId,
        vendor: 'Service Center',
        description: 'Brake servicing',
        createdBy: new mongoose.Types.ObjectId(),
      },
    ]);

    const response = await request(app)
      .get(`/api/v1/expenses?category=fuel&startDate=2026-05-01&endDate=2026-05-20`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.data).toHaveLength(1);
    expect(response.body.data.data[0].category).toBe('fuel');
  });

  it('should return totals grouped by month, category, vehicle and payment status', async () => {
    await ExpenseModel.insertMany([
      {
        category: 'fuel',
        date: new Date('2026-05-18'),
        amount: 4000,
        vehicle: vehicleId,
        firm: firmId,
        vendor: 'HPCL',
        description: 'Fuel expense',
        paymentStatus: 'paid',
        createdBy: new mongoose.Types.ObjectId(),
      },
      {
        category: 'fuel',
        date: new Date('2026-05-22'),
        amount: 2500,
        vehicle: vehicleId,
        firm: firmId,
        vendor: 'HPCL',
        description: 'Fuel expense 2',
        paymentStatus: 'pending',
        createdBy: new mongoose.Types.ObjectId(),
      },
      {
        category: 'maintenance',
        date: new Date('2026-05-30'),
        amount: 7000,
        vehicle: vehicleId,
        firm: firmId,
        vendor: 'Workshop',
        description: 'Tyre replacement',
        paymentStatus: 'paid',
        createdBy: new mongoose.Types.ObjectId(),
      },
    ]);

    const response = await request(app)
      .get('/api/v1/expenses/summary?month=5&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.monthlyTotal).toBe(13500);
    expect(response.body.data.categoryTotals.fuel).toBe(6500);
    expect(response.body.data.vehicleTotals[0].total).toBe(13500);
    expect(response.body.data.paymentStatusTotals.paid.total).toBe(11000);
    expect(response.body.data.paymentStatusTotals.pending.total).toBe(2500);
  });

  it('should track driver wage payments separately from billing', async () => {
    const driverExpense = await ExpenseModel.create({
      category: 'driver_wages',
      date: new Date('2026-05-05'),
      amount: 12000,
      description: 'May wage settlement for driver',
      vendor: 'Driver: Ramesh Kumar',
      grossWage: 15000,
      adjustments: 500,
      finalPayment: 12000,
      applicableDays: 12,
      paymentStatus: 'paid',
      paymentDate: new Date('2026-05-06'),
      driverWageDetails: {
        driverId: new mongoose.Types.ObjectId(),
        month: 5,
        year: 2026,
        daysWorked: 12,
        wageRate: 1250,
        grossWage: 15000,
        adjustments: 500,
        finalPayment: 12000,
        paymentStatus: 'paid',
        paymentDate: new Date('2026-05-06'),
        notes: 'Monthly wages for May',
      },
      createdBy: new mongoose.Types.ObjectId(),
    });

    const response = await request(app)
      .get('/api/v1/expenses?category=driver_wages')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.data[0]._id).toBe(String(driverExpense._id));
    expect(response.body.data.data[0].paymentStatus).toBe('paid');
    expect(response.body.data.data[0].driverWageDetails.finalPayment).toBe(12000);
  });

  it('should track driver advance payments separately from monthly wages', async () => {
    const advanceExpense = await ExpenseModel.create({
      category: 'driver_advance',
      date: new Date('2026-05-02'),
      amount: 5000,
      description: 'Advance payment against upcoming May work',
      vendor: 'Driver: Ramesh Kumar',
      paymentStatus: 'paid',
      paymentDate: new Date('2026-05-02'),
      driverAdvanceDetails: {
        driverId: new mongoose.Types.ObjectId(),
        month: 5,
        year: 2026,
        advanceAmount: 5000,
        recoveryMode: 'salary_deduction',
        adjustedAgainstWage: false,
        notes: 'Advance recovered from upcoming wage payout',
      },
      createdBy: new mongoose.Types.ObjectId(),
    });

    const response = await request(app)
      .get('/api/v1/expenses?category=driver_advance')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.data[0]._id).toBe(String(advanceExpense._id));
    expect(response.body.data.data[0].driverAdvanceDetails.advanceAmount).toBe(5000);
    expect(response.body.data.data[0].driverAdvanceDetails.recoveryMode).toBe('salary_deduction');
  });

  it('should track loading and unloading contractor payments separately from invoice billing', async () => {
    const contractorExpense = await ExpenseModel.create({
      category: 'loading_unloading',
      date: new Date('2026-05-10'),
      amount: 8500,
      vehicle: vehicleId,
      firm: firmId,
      vendor: 'Polypack Contractor',
      description: 'Loading and unloading charges for May',
      paymentStatus: 'pending',
      loadingUnloadingDetails: {
        contractorName: 'Polypack Contractor',
        month: 5,
        year: 2026,
        chargeType: 'loading_unloading',
        reference: 'Monthly statement 05/2026',
      },
      createdBy: new mongoose.Types.ObjectId(),
    });

    const response = await request(app)
      .get('/api/v1/expenses?category=loading_unloading')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.data[0]._id).toBe(String(contractorExpense._id));
    expect(response.body.data.data[0].loadingUnloadingDetails.contractorName).toBe('Polypack Contractor');
    expect(response.body.data.data[0].paymentStatus).toBe('pending');
  });

  it('should update and soft delete an expense', async () => {
    const created = await ExpenseModel.create({
      category: 'other',
      date: new Date('2026-05-12'),
      amount: 1200,
      vehicle: vehicleId,
      firm: firmId,
      vendor: 'Misc vendor',
      description: 'Cleaning material',
      createdBy: new mongoose.Types.ObjectId(),
    });

    const updateResponse = await request(app)
      .patch(`/api/v1/expenses/${created._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Cleaning material used for transit', amount: 1350 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.amount).toBe(1350);

    const deleteResponse = await request(app)
      .delete(`/api/v1/expenses/${created._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    const saved = await ExpenseModel.findById(created._id);
    expect(saved?.isDeleted).toBe(true);
  });
});
