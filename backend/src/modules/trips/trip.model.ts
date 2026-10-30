import mongoose, { Document, Schema } from 'mongoose';

export type TripOperationalStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ITrip extends Document {
  tripDate: Date;
  vehicleId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  firmId: mongoose.Types.ObjectId;
  contractId: mongoose.Types.ObjectId;
  contractVersionId: mongoose.Types.ObjectId;
  billingInvoiceId?: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  pickupLocation: string;
  dropLocation: string;
  startKm?: number;
  endKm?: number;
  totalKm: number;
  /** Hiring rate entered for this trip. Absent on trips created before trip-level hiring. */
  hiringChargePerRound?: mongoose.Types.Decimal128;
  /** When absent, billing uses the contract KM-slab multiplier. */
  hiringMultiplier?: number;
  /** Optional loading/unloading charge. Absent means it is not billed. */
  courierCharges?: mongoose.Types.Decimal128;
  routeDistanceSnapshot?: {
    routeId: mongoose.Types.ObjectId;
    routeName: string;
    expectedDistanceKm: number;
    capturedAt: Date;
  };
  rateSnapshot?: {
    hiringChargePerRound?: string;
    hiringMultiplier?: string;
    averageKmPerLitre: string;
    fuelRatePerLitre: string;
    capturedAt: Date;
    sources: {
      hiringChargePerRound?: 'trip' | 'trip_snapshot' | 'vehicle' | 'contract_capacity';
      hiringMultiplier?: 'trip';
      averageKmPerLitre: 'vehicle' | 'contract_capacity';
      fuelRatePerLitre: 'vehicle' | 'global_hsd' | 'contract_fallback';
    };
  };
  operationalStatus: TripOperationalStatus;
  toll?: {
    amount: mongoose.Types.Decimal128;
    reference?: string;
    notes?: string;
  };
  operationalInfo?: Record<string, unknown>;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tripSchema = new Schema<ITrip>(
  {
    tripDate: { type: Date, required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    contractVersionId: { type: Schema.Types.ObjectId, ref: 'ContractVersion', required: true, index: true },
    billingInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', index: true },
    pickupLocation: { type: String, required: true, trim: true },
    dropLocation: { type: String, required: true, trim: true },
    startKm: { type: Number, min: 0 },
    endKm: { type: Number, min: 0 },
    totalKm: { type: Number, required: true, min: 0 },
    hiringChargePerRound: { type: Schema.Types.Decimal128, min: 0 },
    hiringMultiplier: { type: Number, min: 0 },
    courierCharges: { type: Schema.Types.Decimal128, min: 0 },
    routeDistanceSnapshot: { type: Schema.Types.Mixed, default: undefined },
    rateSnapshot: { type: Schema.Types.Mixed, default: undefined },
    operationalStatus: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'cancelled'],
      default: 'planned',
      index: true,
    },
    toll: {
      amount: { type: Schema.Types.Decimal128, required: true, min: 0 },
      reference: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    operationalInfo: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

tripSchema.index({ firmId: 1, tripDate: -1 });
tripSchema.index({ vehicleId: 1, tripDate: -1 });
tripSchema.index({ driverId: 1, tripDate: -1 });
tripSchema.index({ isDeleted: 1, operationalStatus: 1, tripDate: 1 });

export const TripModel = mongoose.model<ITrip>('Trip', tripSchema);