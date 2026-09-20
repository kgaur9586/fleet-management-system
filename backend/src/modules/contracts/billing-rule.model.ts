import mongoose, { Schema } from 'mongoose';

export type TollTreatment = 'excluded' | 'actual' | 'fixed';
export type ChargeBasis = 'flat' | 'perTrip' | 'perKm' | 'perRound';

export interface IHiringMultiplierRule {
  minKm: number;
  maxKm?: number;
  multiplier: number;
}

export interface IKmThresholdRule {
  upToKm?: number;
  rounds: number;
}

export interface ICapacityBillingRule {
  capacity: number;
  contractualAverageKmPerLitre: mongoose.Types.Decimal128;
  baseHiringRatePerRound: mongoose.Types.Decimal128;
  hiringMultiplierRules?: IHiringMultiplierRule[];
}

export interface IOtherBillableCharge {
  code: string;
  name: string;
  amount: mongoose.Types.Decimal128;
  basis: ChargeBasis;
  isActive: boolean;
}

export interface IBillingRules {
  capacityRates: ICapacityBillingRule[];
  fuelRatePerLitre: mongoose.Types.Decimal128;
  kmThresholds: IKmThresholdRule[];
  tollTreatment: TollTreatment;
  otherBillableCharges: IOtherBillableCharge[];
}

const hiringMultiplierRuleSchema = new Schema<IHiringMultiplierRule>(
  {
    minKm: { type: Number, required: true, min: 0 },
    maxKm: { type: Number, min: 0 },
    multiplier: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const kmThresholdRuleSchema = new Schema<IKmThresholdRule>(
  {
    upToKm: { type: Number, min: 0 },
    rounds: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const capacityBillingRuleSchema = new Schema<ICapacityBillingRule>(
  {
    capacity: { type: Number, required: true, min: 0 },
    contractualAverageKmPerLitre: { type: Schema.Types.Decimal128, required: true, min: 0 },
    baseHiringRatePerRound: { type: Schema.Types.Decimal128, required: true, min: 0 },
    hiringMultiplierRules: { type: [hiringMultiplierRuleSchema], default: [] },
  },
  { _id: false }
);

const otherBillableChargeSchema = new Schema<IOtherBillableCharge>(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Schema.Types.Decimal128, required: true, min: 0 },
    basis: { type: String, enum: ['flat', 'perTrip', 'perKm', 'perRound'], required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

export const billingRulesSchema = new Schema<IBillingRules>(
  {
    capacityRates: { type: [capacityBillingRuleSchema], required: true, default: [] },
    fuelRatePerLitre: { type: Schema.Types.Decimal128, required: true, min: 0 },
    kmThresholds: { type: [kmThresholdRuleSchema], required: true, default: [] },
    tollTreatment: { type: String, enum: ['excluded', 'actual', 'fixed'], required: true },
    otherBillableCharges: { type: [otherBillableChargeSchema], default: [] },
  },
  { _id: false }
);