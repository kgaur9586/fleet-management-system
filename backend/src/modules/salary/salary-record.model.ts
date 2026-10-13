import mongoose, { Document, Schema } from 'mongoose';

export type SalaryPaymentStatus = 'pending' | 'paid';
export type SalaryPaymentMode = 'cash' | 'bank_transfer' | 'cheque' | 'other';

export interface ISalaryRecord extends Document {
  _id: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  /** Count of distinct calendar dates with at least one assigned trip; independent of trip count/status. */
  daysWorked: number;
  /** Single rate snapshot for the whole month, taken from the driver record at generation time. */
  dailyWageRate: mongoose.Types.Decimal128;
  grossWages: mongoose.Types.Decimal128;
  advanceDeduction: mongoose.Types.Decimal128;
  otherDeductions: mongoose.Types.Decimal128;
  netPayable: mongoose.Types.Decimal128;
  paymentStatus: SalaryPaymentStatus;
  paidOn?: Date;
  paymentMode?: SalaryPaymentMode;
  paymentReference?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const salaryRecordSchema = new Schema<ISalaryRecord>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    daysWorked: { type: Number, required: true, min: 0 },
    dailyWageRate: { type: Schema.Types.Decimal128, required: true },
    grossWages: { type: Schema.Types.Decimal128, required: true },
    advanceDeduction: { type: Schema.Types.Decimal128, required: true, default: 0 },
    otherDeductions: { type: Schema.Types.Decimal128, required: true, default: 0 },
    netPayable: { type: Schema.Types.Decimal128, required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    paidOn: { type: Date },
    paymentMode: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'other'] },
    paymentReference: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

salaryRecordSchema.index({ driverId: 1, year: 1, month: 1 }, { unique: true });

export const SalaryRecordModel = mongoose.model<ISalaryRecord>('SalaryRecord', salaryRecordSchema);
