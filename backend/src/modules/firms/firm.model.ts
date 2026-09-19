import mongoose, { Document, Schema } from 'mongoose';

export interface IFirm extends Document {
  name: string;
  billingName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pinCode?: string;
  };
  contactDetails?: {
    name?: string;
    email?: string;
    mobile?: string;
  };
  gstNumber?: string;
  isActive: boolean;
  billingConfiguration?: Record<string, any>;
  notes?: string;
  isDeleted: boolean; // Soft delete
  createdAt: Date;
  updatedAt: Date;
}

const firmSchema = new Schema<IFirm>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    billingName: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pinCode: { type: String, trim: true },
    },
    contactDetails: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      mobile: { type: String, trim: true },
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    billingConfiguration: {
      type: Schema.Types.Mixed,
      default: {},
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

export const FirmModel = mongoose.model<IFirm>('Firm', firmSchema);
