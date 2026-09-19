import mongoose, { Document, Schema } from 'mongoose';

export interface IDriverHistoryEvent {
  eventType: 'hired' | 'suspended' | 'terminated' | 'rejoined' | 'other';
  date: Date;
  notes?: string;
}

export interface IDriver extends Document {
  name: string;
  mobile: string;
  employeeId?: string;
  joiningDate?: Date;
  dailyWage: mongoose.Types.Decimal128; // Using Decimal128 for monetary values
  isActive: boolean;
  notes?: string;
  history: IDriverHistoryEvent[];
  isDeleted: boolean; // Soft delete
  createdAt: Date;
  updatedAt: Date;
}

const driverHistorySchema = new Schema<IDriverHistoryEvent>(
  {
    eventType: {
      type: String,
      enum: ['hired', 'suspended', 'terminated', 'rejoined', 'other'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const driverSchema = new Schema<IDriver>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple nulls/undefined but enforce unique if provided
      unique: true,
      index: true,
    },
    joiningDate: {
      type: Date,
    },
    dailyWage: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    history: {
      type: [driverHistorySchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DriverModel = mongoose.model<IDriver>('Driver', driverSchema);
