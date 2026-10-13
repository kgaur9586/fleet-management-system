import mongoose, { ClientSession, FilterQuery } from 'mongoose';
import { DriverAdvanceModel, IDriverAdvance } from './driver-advance.model';
import { DriverAdvanceRecoveryModel } from './driver-advance-recovery.model';
import { DriverModel } from '../drivers/driver.model';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { round2, toNumber } from '../../common/decimal';

interface CreateAdvanceInput {
  driverId: string;
  amount: number;
  date?: Date;
  notes?: string;
  createdBy: string;
}

interface QueryOptions {
  page?: number;
  limit?: number;
  driverId?: string;
  includeSettled?: boolean;
}

export interface PayrollDeductionBreakdownEntry {
  advanceId: string;
  amount: number;
  remainingOnAdvance: number;
}

export interface PayrollDeductionResult {
  requested: number;
  applied: number;
  carriedForward: number;
  breakdown: PayrollDeductionBreakdownEntry[];
}

export class DriverAdvanceService {
  static async create(data: CreateAdvanceInput) {
    if (data.amount <= 0) throw new BadRequestError('Advance amount must be greater than zero');
    const driver = await DriverModel.findOne({ _id: data.driverId, isDeleted: false });
    if (!driver) throw new NotFoundError('Driver not found');

    return DriverAdvanceModel.create({
      driverId: data.driverId,
      amount: data.amount,
      outstandingAmount: data.amount,
      date: data.date ?? new Date(),
      notes: data.notes,
      createdBy: data.createdBy,
    });
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, driverId, includeSettled = true } = options;
    const query: FilterQuery<IDriverAdvance> = { isDeleted: false };
    if (driverId) query.driverId = driverId;
    if (!includeSettled) query.outstandingAmount = { $gt: 0 };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      DriverAdvanceModel.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).populate('driverId', 'name mobile'),
      DriverAdvanceModel.countDocuments(query),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getById(id: string) {
    const advance = await DriverAdvanceModel.findOne({ _id: id, isDeleted: false }).populate('driverId', 'name mobile');
    if (!advance) throw new NotFoundError('Driver advance not found');
    const recoveries = await DriverAdvanceRecoveryModel.find({ advanceId: id }).sort({ date: -1 });
    return { advance, recoveries };
  }

  static async getOutstandingTotal(driverId: string) {
    const result = await DriverAdvanceModel.aggregate([
      { $match: { driverId: new mongoose.Types.ObjectId(driverId), isDeleted: false } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$outstandingAmount' } } } },
    ]);
    return round2(Number(result[0]?.total || 0));
  }

  /**
   * Deducts `requestedAmount` from the driver's oldest outstanding advances first, capped at both
   * the total outstanding balance and `availableWage`. The remainder is never force-applied —
   * it stays outstanding on the advance(s) for a future payroll cycle.
   */
  static async applyPayrollDeduction(input: {
    driverId: string;
    salaryRecordId: string;
    requestedAmount: number;
    availableWage: number;
    createdBy: string;
    session?: ClientSession;
  }): Promise<PayrollDeductionResult> {
    const { driverId, salaryRecordId, requestedAmount, availableWage, createdBy, session } = input;
    if (requestedAmount < 0) throw new BadRequestError('Deduction amount cannot be negative');

    const cappedTarget = round2(Math.max(0, Math.min(requestedAmount, availableWage)));
    if (cappedTarget === 0) {
      return { requested: round2(requestedAmount), applied: 0, carriedForward: round2(requestedAmount), breakdown: [] };
    }

    const advances = await DriverAdvanceModel.find({ driverId, isDeleted: false, outstandingAmount: { $gt: 0 } })
      .sort({ date: 1, createdAt: 1 })
      .session(session ?? null);

    let remainingToApply = cappedTarget;
    const breakdown: PayrollDeductionBreakdownEntry[] = [];

    for (const advance of advances) {
      if (remainingToApply <= 0) break;
      const outstanding = toNumber(advance.outstandingAmount);
      if (outstanding <= 0) continue;
      const chunk = round2(Math.min(outstanding, remainingToApply));

      // Conditional decrement guards against double-application even outside a transaction.
      const updated = await DriverAdvanceModel.findOneAndUpdate(
        { _id: advance._id, outstandingAmount: { $gte: chunk } },
        { $inc: { outstandingAmount: -chunk } },
        { new: true, session: session ?? null }
      );
      if (!updated) continue; // Lost a race to another concurrent deduction; skip and move on.

      await DriverAdvanceRecoveryModel.create(
        [{ advanceId: advance._id, driverId, salaryRecordId, amount: chunk, createdBy }],
        { session }
      );

      breakdown.push({ advanceId: String(advance._id), amount: chunk, remainingOnAdvance: round2(toNumber(updated.outstandingAmount)) });
      remainingToApply = round2(remainingToApply - chunk);
    }

    const applied = round2(cappedTarget - remainingToApply);
    return { requested: round2(requestedAmount), applied, carriedForward: round2(requestedAmount - applied), breakdown };
  }
}
