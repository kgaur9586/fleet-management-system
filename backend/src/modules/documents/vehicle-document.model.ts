import mongoose, { Document, Schema } from 'mongoose';
import { VehicleDocumentStatus } from './vehicle-document.status';

export type VehicleDocumentType = 'rc' | 'insurance' | 'permit' | 'fitness' | 'pollution' | 'other';

export interface IVehicleDocument extends Document {
  vehicleId: mongoose.Types.ObjectId;
  documentType: VehicleDocumentType;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate: Date;
  fileReference?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleDocumentSchema = new Schema<IVehicleDocument>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    documentType: { type: String, enum: ['rc', 'insurance', 'permit', 'fitness', 'pollution', 'other'], required: true, index: true },
    documentNumber: { type: String, trim: true },
    issueDate: { type: Date },
    expiryDate: { type: Date, required: true, index: true },
    fileReference: { type: String, trim: true },
    fileName: { type: String, trim: true },
    contentType: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

vehicleDocumentSchema.index({ vehicleId: 1, documentType: 1, expiryDate: 1 });
vehicleDocumentSchema.index({ expiryDate: 1, vehicleId: 1 });

export const VehicleDocumentModel = mongoose.model<IVehicleDocument>('VehicleDocument', vehicleDocumentSchema);
export type VehicleDocumentWithStatus = IVehicleDocument & { status: VehicleDocumentStatus };
