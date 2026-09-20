import mongoose, { Document, Schema } from 'mongoose';

export type ExpenseCategory =
  | 'fuel'
  | 'toll'
  | 'maintenance'
  | 'service'
  | 'insurance'
  | 'driver_wages'
  | 'driver_advance'
  | 'loading_unloading'
  | 'other';

export interface IExpense extends Document {
  category: ExpenseCategory;
  date: Date;
  amount: number;
  vehicle?: mongoose.Types.ObjectId;
  firm?: mongoose.Types.ObjectId;
  trip?: mongoose.Types.ObjectId;
  vendor?: string;
  description: string;
  attachmentUrl?: string;
  notes?: string;
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'cancelled';
  paymentDate?: Date;
  adjustments?: number;
  grossWage?: number;
  finalPayment?: number;
  applicableDays?: number;
  fuelDetails?: {
    litresPurchased?: number;
    ratePerLitre?: number;
    pumpName?: string;
  };
  tollDetails?: {
    month?: number;
    year?: number;
    source?: string;
  };
  maintenanceDetails?: {
    maintenanceType?: string;
    workshopName?: string;
    odometer?: number;
  };
  serviceDetails?: {
    serviceType?: string;
    workshopName?: string;
    odometer?: number;
  };
  insuranceDetails?: {
    insurerName?: string;
    policyNumber?: string;
    coverageType?: string;
  };
  driverWageDetails?: {
    driverId?: mongoose.Types.ObjectId;
    month?: number;
    year?: number;
    daysWorked?: number;
    wageRate?: number;
    grossWage?: number;
    adjustments?: number;
    finalPayment?: number;
    paymentStatus?: 'pending' | 'paid' | 'partial' | 'cancelled';
    paymentDate?: Date;
    notes?: string;
  };
  driverAdvanceDetails?: {
    driverId?: mongoose.Types.ObjectId;
    month?: number;
    year?: number;
    advanceAmount?: number;
    recoveryMode?: 'salary_deduction' | 'future_trip_settlement' | 'cash_adjustment' | 'other';
    adjustedAgainstWage?: boolean;
    linkedExpenseId?: mongoose.Types.ObjectId;
    notes?: string;
  };
  loadingUnloadingDetails?: {
    contractorName?: string;
    month?: number;
    year?: number;
    chargeType?: string;
    reference?: string;
  };
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: {
      type: String,
      enum: ['fuel', 'toll', 'maintenance', 'service', 'insurance', 'driver_wages', 'driver_advance', 'loading_unloading', 'other'],
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      index: true,
    },
    firm: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      index: true,
    },
    trip: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      index: true,
    },
    vendor: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentDate: {
      type: Date,
      index: true,
    },
    adjustments: {
      type: Number,
      min: 0,
      default: 0,
    },
    grossWage: {
      type: Number,
      min: 0,
    },
    finalPayment: {
      type: Number,
      min: 0,
    },
    applicableDays: {
      type: Number,
      min: 0,
    },
    fuelDetails: {
      litresPurchased: { type: Number, min: 0 },
      ratePerLitre: { type: Number, min: 0 },
      pumpName: { type: String, trim: true },
    },
    tollDetails: {
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number },
      source: { type: String, trim: true },
    },
    maintenanceDetails: {
      maintenanceType: { type: String, trim: true },
      workshopName: { type: String, trim: true },
      odometer: { type: Number, min: 0 },
    },
    serviceDetails: {
      serviceType: { type: String, trim: true },
      workshopName: { type: String, trim: true },
      odometer: { type: Number, min: 0 },
    },
    insuranceDetails: {
      insurerName: { type: String, trim: true },
      policyNumber: { type: String, trim: true },
      coverageType: { type: String, trim: true },
    },
    driverWageDetails: {
      driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number },
      daysWorked: { type: Number, min: 0 },
      wageRate: { type: Number, min: 0 },
      grossWage: { type: Number, min: 0 },
      adjustments: { type: Number, min: 0 },
      finalPayment: { type: Number, min: 0 },
      paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partial', 'cancelled'],
      },
      paymentDate: { type: Date },
      notes: { type: String, trim: true },
    },
    driverAdvanceDetails: {
      driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number },
      advanceAmount: { type: Number, min: 0 },
      recoveryMode: {
        type: String,
        enum: ['salary_deduction', 'future_trip_settlement', 'cash_adjustment', 'other'],
      },
      adjustedAgainstWage: { type: Boolean, default: false },
      linkedExpenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
      notes: { type: String, trim: true },
    },
    loadingUnloadingDetails: {
      contractorName: { type: String, trim: true },
      month: { type: Number, min: 1, max: 12 },
      year: { type: Number },
      chargeType: { type: String, trim: true },
      reference: { type: String, trim: true },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: { type: Date },
    deletedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ vehicle: 1, date: -1 });
expenseSchema.index({ firm: 1, date: -1 });
expenseSchema.index({ isDeleted: 1, date: 1, vehicle: 1 });

export const ExpenseModel = mongoose.model<IExpense>('Expense', expenseSchema);
