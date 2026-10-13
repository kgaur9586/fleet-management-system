import mongoose, { Document, Schema } from 'mongoose';

export interface IFirm extends Document {
  _id: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  billingName?: string;
  /** Short code used as the bill-number prefix, e.g. "NIR". */
  billPrefix?: string;
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
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
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
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
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
    billPrefix: {
      type: String,
      trim: true,
      uppercase: true,
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
    bankDetails: {
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      branchName: { type: String, trim: true },
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

// Bill prefixes must be unique among firms that define one.
firmSchema.index(
  { billPrefix: 1 },
  { unique: true, partialFilterExpression: { billPrefix: { $type: 'string' }, isDeleted: false } }
);

export const FirmModel = mongoose.model<IFirm>('Firm', firmSchema);
