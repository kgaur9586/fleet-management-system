import mongoose, { Document, Schema } from 'mongoose';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'other';
export type PaymentStatus = 'pending' | 'received' | 'cancelled';

export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  firmId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  status: PaymentStatus;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true, index: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'other'],
      required: true,
    },
    referenceNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'received', 'cancelled'],
      default: 'received',
      index: true,
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

paymentSchema.index({ firmId: 1, paymentDate: -1 });
paymentSchema.index({ invoiceId: 1, paymentDate: -1 });
paymentSchema.index({ status: 1, paymentDate: 1, invoiceId: 1 });

export const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);
