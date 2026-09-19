import mongoose, { Document, Schema } from 'mongoose';

export interface IRoute extends Document {
  name: string; // e.g., "Delhi to Mumbai"
  routeCode?: string; // Optional internal code
  pickupLocation: string;
  dropLocation: string;
  intermediateStops?: string[];
  expectedDistanceKm?: number;
  isActive: boolean;
  notes?: string;
  isDeleted: boolean; // Soft delete
  createdAt: Date;
  updatedAt: Date;
}

const routeSchema = new Schema<IRoute>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    routeCode: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    pickupLocation: {
      type: String,
      required: true,
      trim: true,
    },
    dropLocation: {
      type: String,
      required: true,
      trim: true,
    },
    intermediateStops: {
      type: [String],
      default: [],
    },
    expectedDistanceKm: {
      type: Number,
      min: 0,
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

export const RouteModel = mongoose.model<IRoute>('Route', routeSchema);
