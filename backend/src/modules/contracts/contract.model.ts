import mongoose, { Document, Schema } from 'mongoose';

export interface IContract extends Document {
  firmId: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new Schema<IContract>(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

contractSchema.index({ firmId: 1, companyId: 1, isActive: 1 });

export const ContractModel = mongoose.model<IContract>('Contract', contractSchema);