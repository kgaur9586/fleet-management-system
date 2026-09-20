import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicle extends Document {
  registrationNumber: string;
  vehicleType: string;
  capacity: number; // in Metric Tons or standard unit
  make?: string;
  vehicleModel?: string;
  isActive: boolean;
  isDeleted: boolean; // For soft-deletes
  firmId?: mongoose.Types.ObjectId; // Associated firm/customer
  status: 'available' | 'on_trip' | 'maintenance';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: function(v: string) {
          // Allow alphanumeric characters, optionally with dashes or spaces, but trim them for uniqueness.
          // Standardizing by forcing uppercase and no special chars in the application logic.
          return /^[A-Z0-9\-\s]+$/.test(v);
        },
        message: 'Registration number contains invalid characters',
      }
    },
    vehicleType: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    make: {
      type: String,
      trim: true,
    },
    vehicleModel: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm', // Note: Firm model will be implemented in the Firms module
      index: true,
    },
    status: {
      type: String,
      enum: ['available', 'on_trip', 'maintenance'],
      default: 'available',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    }
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to normalize registration number
vehicleSchema.pre('save', function (next) {
  if (this.isModified('registrationNumber')) {
    this.registrationNumber = this.registrationNumber.replace(/[\s\-]/g, '');
  }
  next();
});

vehicleSchema.index({ isDeleted: 1, isActive: 1 });

export const VehicleModel = mongoose.model<IVehicle>('Vehicle', vehicleSchema);
