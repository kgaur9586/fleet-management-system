import { FilterQuery } from 'mongoose';
import { SalaryRecordModel, ISalaryRecord } from './salary-record.model';
import { DriverModel } from '../drivers/driver.model';
import { TripModel } from '../trips/trip.model';
import { DriverAdvanceService } from '../driver-advances/driver-advance.service';
import { DriverAdvanceRecoveryModel } from '../driver-advances/driver-advance-recovery.model';
import { DriverAdvanceModel } from '../driver-advances/driver-advance.model';
import { AuditService } from '../audit/audit.service';
import { withTransaction } from '../../common/transaction';
import { round2, toNumber } from '../../common/decimal';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';

interface GenerateInput {
  driverId: string;
  month: number;
  year: number;
  createdBy: string;
}

interface QueryOptions {
  page?: number;
  limit?: number;
  driverId?: string;
  month?: number;
  year?: number;
  paymentStatus?: ISalaryRecord['paymentStatus'];
}

const monthRange = (year: number, month: number) => ({
  start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
});

export class SalaryService {
  /** Counts distinct worked days and snapshots the driver's current wage rate for the whole month. */
  static async generate(data: GenerateInput) {
    const driver = await DriverModel.findOne({ _id: data.driverId, isDeleted: false });
    if (!driver) throw new NotFoundError('Driver not found');

    const existing = await SalaryRecordModel.findOne({ driverId: data.driverId, month: data.month, year: data.year });
    if (existing) throw new ConflictError('A salary record already exists for this driver and month');

    const { start, end } = monthRange(data.year, data.month);
    const tripDates: Date[] = await TripModel.distinct('tripDate', { driverId: data.driverId, isDeleted: false, tripDate: { $gte: start, $lt: end } });
    // A driver is paid once per calendar day regardless of how many trips fall on it.
    const distinctDays = new Set(tripDates.map((date) => new Date(date).toISOString().slice(0, 10)));
    const daysWorked = distinctDays.size;

    const dailyWageRate = toNumber(driver.dailyWage);
    const grossWages = round2(daysWorked * dailyWageRate);

    const record = await SalaryRecordModel.create({
      driverId: data.driverId,
      month: data.month,
      year: data.year,
      daysWorked,
      dailyWageRate,
      grossWages,
      advanceDeduction: 0,
      otherDeductions: 0,
      netPayable: grossWages,
      paymentStatus: 'pending',
      createdBy: data.createdBy,
    });

    await AuditService.record({
      action: 'salary.generated',
      entityType: 'salary_record',
      entityId: record._id as any,
      userId: data.createdBy,
      changes: { after: { daysWorked, dailyWageRate, grossWages } },
    });

    return record;
  }

  /** Owner-entered deduction amount; actual applied amount is capped by outstanding advances and available wage. */
  static async applyAdvanceDeduction(id: string, requestedAmount: number, createdBy?: string) {
    if (requestedAmount < 0) throw new BadRequestError('Deduction amount cannot be negative');

    return withTransaction(async (session) => {
      const record = await SalaryRecordModel.findById(id).session(session ?? null);
      if (!record) throw new NotFoundError('Salary record not found');
      if (record.paymentStatus === 'paid') throw new ConflictError('Cannot change deductions on a salary record that has already been paid');

      const grossWages = toNumber(record.grossWages);
      const otherDeductions = toNumber(record.otherDeductions);
      const previousDeduction = toNumber(record.advanceDeduction);
      const availableWage = Math.max(0, round2(grossWages - otherDeductions));

      // Undo any previously applied deduction so re-entering a new amount is idempotent, not additive.
      if (previousDeduction > 0) {
        const previousEntries = await DriverAdvanceRecoveryModel.find({ salaryRecordId: record._id }).session(session ?? null);
        for (const entry of previousEntries) {
          await DriverAdvanceModel.findByIdAndUpdate(
            entry.advanceId,
            { $inc: { outstandingAmount: toNumber(entry.amount) } },
            { session: session ?? null }
          );
        }
        await DriverAdvanceRecoveryModel.deleteMany({ salaryRecordId: record._id }, { session });
      }

      const result = await DriverAdvanceService.applyPayrollDeduction({
        driverId: String(record.driverId),
        salaryRecordId: String(record._id),
        requestedAmount,
        availableWage,
        createdBy: createdBy ?? String(record.createdBy),
        session,
      });

      record.advanceDeduction = result.applied as any;
      record.netPayable = round2(grossWages - result.applied - otherDeductions) as any;
      await record.save({ session });

      await AuditService.record({
        action: 'driver_advance.recovery_applied',
        entityType: 'salary_record',
        entityId: record._id as any,
        userId: createdBy,
        changes: { after: { requested: result.requested, applied: result.applied, carriedForward: result.carriedForward } },
        session,
      });

      return { record, deduction: result };
    });
  }

  /** Owner-entered flat deduction (e.g. uniform cost, fine); re-entering an amount replaces the previous one, it is not additive. */
  static async setOtherDeductions(id: string, amount: number, updatedBy?: string) {
    if (amount < 0) throw new BadRequestError('Deduction amount cannot be negative');

    const record = await SalaryRecordModel.findById(id);
    if (!record) throw new NotFoundError('Salary record not found');
    if (record.paymentStatus === 'paid') throw new ConflictError('Cannot change deductions on a salary record that has already been paid');

    const grossWages = toNumber(record.grossWages);
    const advanceDeduction = toNumber(record.advanceDeduction);
    const netPayable = round2(grossWages - advanceDeduction - amount);
    if (netPayable < 0) throw new BadRequestError('Deductions cannot exceed the gross wages for this month');

    const previousAmount = toNumber(record.otherDeductions);
    record.otherDeductions = amount as any;
    record.netPayable = netPayable as any;
    await record.save();

    await AuditService.record({
      action: 'salary.other_deductions_updated',
      entityType: 'salary_record',
      entityId: record._id as any,
      userId: updatedBy,
      changes: { before: { otherDeductions: previousAmount }, after: { otherDeductions: amount, netPayable } },
    });

    return record;
  }

  static async markPaid(id: string, data: { paidOn?: Date; paymentMode?: ISalaryRecord['paymentMode']; paymentReference?: string; notes?: string }, paidBy?: string) {
    const record = await SalaryRecordModel.findById(id);
    if (!record) throw new NotFoundError('Salary record not found');
    if (record.paymentStatus === 'paid') throw new ConflictError('This salary record has already been marked as paid');

    record.paymentStatus = 'paid';
    record.paidOn = data.paidOn ?? new Date();
    record.paymentMode = data.paymentMode;
    record.paymentReference = data.paymentReference;
    if (data.notes) record.notes = data.notes;
    await record.save();

    await AuditService.record({
      action: 'salary.paid',
      entityType: 'salary_record',
      entityId: record._id as any,
      userId: paidBy,
      changes: { after: { netPayable: toNumber(record.netPayable), paidOn: record.paidOn } },
    });

    return record;
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, driverId, month, year, paymentStatus } = options;
    const query: FilterQuery<ISalaryRecord> = {};
    if (driverId) query.driverId = driverId;
    if (month) query.month = month;
    if (year) query.year = year;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SalaryRecordModel.find(query).sort({ year: -1, month: -1, createdAt: -1 }).skip(skip).limit(limit).populate('driverId', 'name mobile dailyWage'),
      SalaryRecordModel.countDocuments(query),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getById(id: string) {
    const record = await SalaryRecordModel.findById(id).populate('driverId', 'name mobile dailyWage');
    if (!record) throw new NotFoundError('Salary record not found');
    const recoveries = await DriverAdvanceRecoveryModel.find({ salaryRecordId: id }).sort({ createdAt: -1 });
    return { record, recoveries };
  }
}
