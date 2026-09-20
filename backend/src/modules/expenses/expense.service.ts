import { FilterQuery } from 'mongoose';
import { ExpenseModel, IExpense } from './expense.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { NotFoundError, ConflictError } from '../../common/errors';

interface QueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  vehicleId?: string;
  firmId?: string;
  tripId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export class ExpenseService {
  static async create(data: Partial<IExpense> & { createdBy?: string; vehicleId?: string; firmId?: string; tripId?: string }) {
    const payload = {
      ...data,
      vehicle: data.vehicleId ?? data.vehicle,
      firm: data.firmId ?? data.firm,
      trip: data.tripId ?? data.trip,
      createdBy: data.createdBy,
    };

    delete (payload as any).vehicleId;
    delete (payload as any).firmId;
    delete (payload as any).tripId;

    return ExpenseModel.create(payload);
  }

  static async update(id: string, data: Partial<IExpense> & { vehicleId?: string; firmId?: string; tripId?: string }) {
    const expense = await ExpenseModel.findOne({ _id: id, isDeleted: false });
    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    if (data.vehicleId) expense.vehicle = data.vehicleId as any;
    if (data.firmId) expense.firm = data.firmId as any;
    if (data.tripId) expense.trip = data.tripId as any;

    delete (data as any).vehicleId;
    delete (data as any).firmId;
    delete (data as any).tripId;

    Object.assign(expense, data);
    return expense.save();
  }

  static async getById(id: string) {
    const expense = await ExpenseModel.findOne({ _id: id, isDeleted: false })
      .populate('vehicle', 'registrationNumber vehicleType capacity')
      .populate('firm', 'name billingName')
      .populate('trip', 'pickupLocation dropLocation totalKm');

    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    return expense;
  }

  static async delete(id: string) {
    const expense = await ExpenseModel.findOne({ _id: id, isDeleted: false });
    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    expense.isDeleted = true;
    expense.deletedAt = new Date();
    await expense.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const {
      page = 1,
      limit = 10,
      category,
      vehicleId,
      firmId,
      tripId,
      search,
      startDate,
      endDate,
    } = options;

    const query: FilterQuery<IExpense> = { isDeleted: false };

    if (category) query.category = category;
    if (vehicleId) query.vehicle = vehicleId;
    if (firmId) query.firm = firmId;
    if (tripId) query.trip = tripId;

    if (startDate || endDate) {
      query.date = {} as any;
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    if (search) {
      const searchTerm = search.trim();
      query.$or = [
        { description: { $regex: searchTerm, $options: 'i' } },
        { vendor: { $regex: searchTerm, $options: 'i' } },
        { notes: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      ExpenseModel.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('vehicle', 'registrationNumber vehicleType capacity')
        .populate('firm', 'name billingName')
        .populate('trip', 'pickupLocation dropLocation totalKm'),
      ExpenseModel.countDocuments(query),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSummary(month?: number, year?: number) {
    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const [monthlyExpenses, categoryTotals, vehicleTotals, paymentStatusAggregate] = await Promise.all([
      ExpenseModel.find({
        isDeleted: false,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      ExpenseModel.aggregate([
        { $match: { isDeleted: false, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      ExpenseModel.aggregate([
        { $match: { isDeleted: false, date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$vehicle',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      ExpenseModel.aggregate([
        { $match: { isDeleted: false, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const normalizedCategoryTotals: Record<string, number> = {};
    for (const item of categoryTotals) {
      normalizedCategoryTotals[item._id] = Number(item.total || 0);
    }

    const normalizedVehicleTotals = await Promise.all(
      vehicleTotals.map(async (item) => {
        const vehicle = await VehicleModel.findById(item._id)
          .select('registrationNumber vehicleType capacity')
          .lean();

        const typedVehicle = vehicle as any;

        return {
          vehicleId: item._id,
          registrationNumber: typedVehicle?.registrationNumber ?? null,
          vehicleType: typedVehicle?.vehicleType ?? null,
          total: Number(item.total || 0),
          count: item.count,
        };
      })
    );

    const paymentStatusTotals: Record<string, { total: number; count: number }> = {};
    for (const item of paymentStatusAggregate) {
      paymentStatusTotals[item._id ?? 'unknown'] = {
        total: Number(item.total || 0),
        count: Number(item.count || 0),
      };
    }

    return {
      month: targetMonth,
      year: targetYear,
      monthlyTotal,
      categoryTotals: normalizedCategoryTotals,
      vehicleTotals: normalizedVehicleTotals,
      paymentStatusTotals,
    };
  }
}
