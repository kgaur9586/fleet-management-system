import mongoose, { Document, Schema } from 'mongoose';

/**
 * Global diesel (HSD) rate history. Applies to every firm/vehicle; look up the most recent
 * rate with `effectiveFrom <= date` — the next rate's effectiveFrom implicitly bounds this one,
 * so `effectiveTo` is informational only and never modified (docs: "old documents are never modified").
 */
export interface IHsdRate extends Document {
  _id: mongoose.Types.ObjectId;
  ratePerLitre: mongoose.Types.Decimal128;
  effectiveFrom: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hsdRateSchema = new Schema<IHsdRate>(
  {
    ratePerLitre: { type: Schema.Types.Decimal128, required: true },
    effectiveFrom: { type: Date, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

hsdRateSchema.index({ effectiveFrom: -1 }, { unique: true });

export const HsdRateModel = mongoose.model<IHsdRate>('HsdRate', hsdRateSchema);
