import mongoose, { Document, Schema } from 'mongoose';

/**
 * Append-only ledger of advance recoveries. Every entry is a payroll deduction tied to the
 * salary record it was deducted from, so recovery never shows up as a separate expense.
 */
export interface IDriverAdvanceRecovery extends Document {
  advanceId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  salaryRecordId: mongoose.Types.ObjectId;
  amount: mongoose.Types.Decimal128;
  date: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const driverAdvanceRecoverySchema = new Schema<IDriverAdvanceRecovery>(
  {
    advanceId: { type: Schema.Types.ObjectId, ref: 'DriverAdvance', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    salaryRecordId: { type: Schema.Types.ObjectId, ref: 'SalaryRecord', required: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const DriverAdvanceRecoveryModel = mongoose.model<IDriverAdvanceRecovery>(
  'DriverAdvanceRecovery',
  driverAdvanceRecoverySchema
);
