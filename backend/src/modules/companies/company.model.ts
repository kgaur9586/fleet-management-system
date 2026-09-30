import mongoose, { Document, Schema } from 'mongoose';

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  legalName?: string;
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
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    legalName: { type: String, trim: true },
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
    gstNumber: { type: String, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

companySchema.index({ isDeleted: 1, isActive: 1 });

export const CompanyModel = mongoose.model<ICompany>('Company', companySchema);
