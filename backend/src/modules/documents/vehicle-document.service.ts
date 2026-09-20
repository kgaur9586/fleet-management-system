import crypto from 'crypto';
import path from 'path';
import { FilterQuery } from 'mongoose';
import { ConflictError, NotFoundError } from '../../common/errors';
import { VehicleModel } from '../vehicles/vehicle.model';
import { getObjectStorage } from './storage';
import { IVehicleDocument, VehicleDocumentModel } from './vehicle-document.model';
import { getVehicleDocumentStatus, VehicleDocumentStatus } from './vehicle-document.status';

interface DocumentMetadata {
  vehicleId: string;
  documentType: IVehicleDocument['documentType'];
  documentNumber?: string;
  issueDate?: Date;
  expiryDate: Date;
  fileReference?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  notes?: string;
  createdBy: string;
}

const publicDocument = (document: IVehicleDocument) => ({
  ...document.toObject(),
  status: getVehicleDocumentStatus(document.expiryDate),
});

const cleanFileName = (fileName: string) => path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');

export class VehicleDocumentService {
  static async create(data: DocumentMetadata) {
    await this.requireVehicle(data.vehicleId);
    return VehicleDocumentModel.create(data).then(publicDocument);
  }

  static async upload(data: DocumentMetadata, file: Express.Multer.File) {
    await this.requireVehicle(data.vehicleId);
    const key = `${data.vehicleId}/${crypto.randomUUID()}-${cleanFileName(file.originalname)}`;
    const stored = await getObjectStorage().put({ key, content: file.buffer, contentType: file.mimetype });
    const document = await VehicleDocumentModel.create({
      ...data,
      fileReference: stored.key,
      fileName: file.originalname,
      contentType: stored.contentType,
      fileSize: stored.size,
    });
    return publicDocument(document);
  }

  static async list(options: { vehicleId?: string; documentType?: IVehicleDocument['documentType']; status?: VehicleDocumentStatus; page?: number; limit?: number }) {
    const { vehicleId, documentType, status, page = 1, limit = 20 } = options;
    const query: FilterQuery<IVehicleDocument> = {};
    if (vehicleId) query.vehicleId = vehicleId;
    if (documentType) query.documentType = documentType;
    if (status) {
      const now = new Date();
      const threshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (status === 'expired') query.expiryDate = { $lt: now };
      if (status === 'expiring_soon') query.expiryDate = { $gte: now, $lte: threshold };
      if (status === 'active') query.expiryDate = { $gt: threshold };
    }

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      VehicleDocumentModel.find(query).sort({ expiryDate: 1, createdAt: -1 }).skip(skip).limit(limit),
      VehicleDocumentModel.countDocuments(query),
    ]);
    return {
      data: documents.map(publicDocument),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string) {
    const document = await VehicleDocumentModel.findById(id);
    if (!document) throw new NotFoundError('Vehicle document not found');
    return publicDocument(document);
  }

  static async getFile(id: string) {
    const document = await VehicleDocumentModel.findById(id);
    if (!document) throw new NotFoundError('Vehicle document not found');
    if (!document.fileReference) throw new NotFoundError('No file is attached to this document');
    const file = await getObjectStorage().get(document.fileReference);
    return { document, file };
  }

  private static async requireVehicle(vehicleId: string) {
    const vehicle = await VehicleModel.findOne({ _id: vehicleId, isDeleted: false });
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    if (!vehicle.isActive) throw new ConflictError('Documents cannot be added to an inactive vehicle');
    return vehicle;
  }
}
