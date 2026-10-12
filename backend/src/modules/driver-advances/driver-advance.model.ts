import mongoose, { Document, Schema } from 'mongoose';

export interface IDriverAdvance extends Document {
  _id: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  amount: mongoose.Types.Decimal128;
  date: Date;
  /** Denormalized running balance; decremented atomically as payroll deductions are applied. */
  outstandingAmount: mongoose.Types.Decimal128;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const driverAdvanceSchema = new Schema<IDriverAdvance>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    date: { type: Date, required: true, default: Date.now },
    outstandingAmount: { type: Schema.Types.Decimal128, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

driverAdvanceSchema.index({ driverId: 1, isDeleted: 1, date: 1 });

export const DriverAdvanceModel = mongoose.model<IDriverAdvance>('DriverAdvance', driverAdvanceSchema);
