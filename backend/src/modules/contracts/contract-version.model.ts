import mongoose, { Document, Schema } from 'mongoose';
import { billingRulesSchema, IBillingRules } from './billing-rule.model';

export interface IContractVersion extends Document {
  contractId: mongoose.Types.ObjectId;
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  billingRules: IBillingRules;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractVersionSchema = new Schema<IContractVersion>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date, index: true },
    billingRules: { type: billingRulesSchema, required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

contractVersionSchema.index({ contractId: 1, effectiveFrom: -1 }, { unique: true });
contractVersionSchema.index({ contractId: 1, effectiveTo: 1, effectiveFrom: -1 });

export const ContractVersionModel = mongoose.model<IContractVersion>(
  'ContractVersion',
  contractVersionSchema
);