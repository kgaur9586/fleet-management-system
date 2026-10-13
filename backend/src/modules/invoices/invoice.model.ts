import mongoose, { Document, Schema } from 'mongoose';

export type InvoiceStatus = 'draft' | 'review' | 'approved' | 'finalized';

/** Settlement state is tracked separately from the approval lifecycle. */
export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface IInvoiceCalculationSnapshot {
  tripId?: string;
  distanceKm: string;
  contractualAverage: string;
  fuelLitres: string;
  fuelRate: string;
  fuelAmount: string;
  hiringMultiplier: string;
  baseHiringRate: string;
  hiringAmount: string;
  tollAmount: string;
  otherBillableAmount: string;
  totalAmount: string;
  contractId: string;
  contractVersionId: string;
  contractVersion?: number;
  vehicleId?: string;
  vehicleCapacity: number;
  rounding: {
    monetaryScale: number;
    monetaryMode: 'ROUND_HALF_UP';
    intermediateValuesRounded: false;
  };
}

export interface IInvoiceLineItem {
  tripId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  contractId: mongoose.Types.ObjectId;
  contractVersionId: mongoose.Types.ObjectId;
  contractVersion?: number;
  tripSnapshot: {
    tripDate: Date;
    vehicle: { id: string; registrationNumber: string; vehicleType?: string };
    driver: { id: string; name: string };
    route?: { id: string; name: string; routeCode?: string } | null;
    pickupLocation: string;
    dropLocation: string;
    startKm?: number;
    endKm?: number;
    totalKm: number;
    operationalStatus: string;
    contract: { id: string; name: string };
    contractVersion: { id: string; version?: number };
    distanceKm: string;
    tollAmount: string;
  };
  vehicleSnapshot: {
    registrationNumber: string;
    vehicleType?: string;
    capacity: number;
  };
  snapshot: IInvoiceCalculationSnapshot;
  createdAt: Date;
}

export interface IInvoice extends Document {
  firmId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  invoiceNumber?: string;
  /** Manual register reference printed alongside the bill number. */
  bookNumber?: string;
  status: InvoiceStatus;
  generatedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  finalizedBy?: mongoose.Types.ObjectId;
  generatedAt: Date;
  approvedAt?: Date;
  finalizedAt?: Date;
  notes?: string;
  approvalNotes?: string;
  finalizationNotes?: string;
  companySnapshot: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
  };
  firmSnapshot: {
    name: string;
    billingName?: string;
    billPrefix?: string;
    address?: string;
    phone?: string;
    gstNumber?: string;
    bankDetails?: {
      accountName?: string;
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      branchName?: string;
    };
  };
  vehicleSnapshot: {
    registrationNumber: string;
    vehicleType?: string;
    capacity: number;
  };
  lineItems: IInvoiceLineItem[];
  summary: {
    vehicleCount: number;
    tripCount: number;
    totalDistanceKm: number;
    fuelAmount: number;
    hiringAmount: number;
    tollAmount: number;
    otherBillableAmount: number;
    totalAmount: number;
  };
  duplicateTripGuard?: {
    tripCount: number;
    tripIds: string[];
    hash: string;
    generatedAt: Date;
  };
  reopenHistory?: Array<{
    reopenedAt: Date;
    reopenedBy?: mongoose.Types.ObjectId;
    reason: string;
    previousStatus: InvoiceStatus;
    previousInvoiceNumber?: string;
  }>;
  paymentStatus: InvoicePaymentStatus;
  totalPaid: number;
  outstandingAmount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    contractVersionId: { type: Schema.Types.ObjectId, ref: 'ContractVersion', required: true, index: true },
    contractVersion: { type: Number, min: 1 },
    tripSnapshot: { type: Schema.Types.Mixed, required: true },
    vehicleSnapshot: { type: Schema.Types.Mixed, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    invoiceNumber: { type: String, trim: true, unique: true, sparse: true },
    bookNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'review', 'approved', 'finalized'],
      default: 'draft',
      index: true,
    },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    generatedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    finalizedAt: { type: Date },
    notes: { type: String, trim: true },
    approvalNotes: { type: String, trim: true },
    finalizationNotes: { type: String, trim: true },
    companySnapshot: { type: Schema.Types.Mixed, required: true },
    firmSnapshot: { type: Schema.Types.Mixed, required: true },
    vehicleSnapshot: { type: Schema.Types.Mixed, required: true },
    lineItems: { type: [invoiceLineItemSchema], default: [] },
    summary: {
      vehicleCount: { type: Number, default: 0 },
      tripCount: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0 },
      fuelAmount: { type: Number, default: 0 },
      hiringAmount: { type: Number, default: 0 },
      tollAmount: { type: Number, default: 0 },
      otherBillableAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    duplicateTripGuard: {
      tripCount: { type: Number, default: 0 },
      tripIds: { type: [String], default: [] },
      hash: { type: String, trim: true },
      generatedAt: { type: Date, default: Date.now },
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
      index: true,
    },
    reopenHistory: {
      type: [
        new Schema(
          {
            reopenedAt: { type: Date, required: true },
            reopenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
            reason: { type: String, required: true, trim: true },
            previousStatus: { type: String, required: true },
            previousInvoiceNumber: { type: String, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    totalPaid: { type: Number, default: 0, min: 0 },
    outstandingAmount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ firmId: 1, vehicleId: 1, month: 1, year: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ firmId: 1, month: 1, year: 1, status: 1 });
invoiceSchema.index({ isDeleted: 1, status: 1, year: 1, month: 1 });
invoiceSchema.index({ status: 1, paymentStatus: 1, outstandingAmount: -1 });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', invoiceSchema);
