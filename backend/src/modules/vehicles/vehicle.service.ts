import { VehicleModel, IVehicle } from './vehicle.model';
import { NotFoundError, ConflictError } from '../../common/errors';
import { FilterQuery } from 'mongoose';

interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  isActive?: boolean;
  vehicleType?: string;
  firmId?: string;
}

export class VehicleService {
  static async create(data: Partial<IVehicle>) {
    // Normalize registration number format to avoid duplicates
    const normalizedRegNo = data.registrationNumber?.replace(/[\s\-]/g, '').toUpperCase();
    
    if (normalizedRegNo) {
      const existing = await VehicleModel.findOne({ 
        registrationNumber: normalizedRegNo, 
        isDeleted: false 
      });
      if (existing) {
        throw new ConflictError('A vehicle with this registration number already exists');
      }
    }

    if (data.firmId) {
      data.vehicleNumberPerFirm = await this.resolveVehicleNumber(String(data.firmId), data.vehicleNumberPerFirm);
    }

    return VehicleModel.create(data);
  }

  static async update(id: string, data: Partial<IVehicle>) {
    const vehicle = await VehicleModel.findOne({ _id: id, isDeleted: false });
    if (!vehicle) {
      throw new NotFoundError('Vehicle not found');
    }

    if (data.registrationNumber) {
      const normalizedRegNo = data.registrationNumber.replace(/[\s\-]/g, '').toUpperCase();
      const existing = await VehicleModel.findOne({
        registrationNumber: normalizedRegNo,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existing) {
        throw new ConflictError('Another vehicle with this registration number already exists');
      }
    }

    const targetFirmId = data.firmId !== undefined ? data.firmId : vehicle.firmId;
    if (targetFirmId) {
      const firmChanged = String(targetFirmId) !== String(vehicle.firmId ?? '');
      if (data.vehicleNumberPerFirm !== undefined || firmChanged) {
        data.vehicleNumberPerFirm = await this.resolveVehicleNumber(
          String(targetFirmId),
          data.vehicleNumberPerFirm ?? (firmChanged ? undefined : vehicle.vehicleNumberPerFirm),
          id
        );
      }
    } else {
      data.vehicleNumberPerFirm = undefined;
    }

    Object.assign(vehicle, data);
    return vehicle.save();
  }

  /** Keeps the per-firm number stable: supplied values are validated, otherwise the next free number is taken. */
  private static async resolveVehicleNumber(firmId: string, requested?: number, excludeId?: string) {
    if (requested !== undefined) {
      const clash: FilterQuery<IVehicle> = { firmId, vehicleNumberPerFirm: requested, isDeleted: false };
      if (excludeId) clash._id = { $ne: excludeId };
      if (await VehicleModel.findOne(clash)) {
        throw new ConflictError('Another vehicle in this firm already uses this vehicle number');
      }
      return requested;
    }

    const highest = await VehicleModel.findOne({ firmId, isDeleted: false, vehicleNumberPerFirm: { $exists: true } })
      .sort({ vehicleNumberPerFirm: -1 })
      .select('vehicleNumberPerFirm');
    return (highest?.vehicleNumberPerFirm ?? 0) + 1;
  }

  static async getById(id: string) {
    const vehicle = await VehicleModel.findOne({ _id: id, isDeleted: false }).populate('firmId', 'name');
    if (!vehicle) {
      throw new NotFoundError('Vehicle not found');
    }
    return vehicle;
  }

  static async delete(id: string) {
    const vehicle = await VehicleModel.findOne({ _id: id, isDeleted: false });
    if (!vehicle) {
      throw new NotFoundError('Vehicle not found');
    }

    // Soft delete
    vehicle.isDeleted = true;
    vehicle.isActive = false;
    await vehicle.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      isActive, 
      vehicleType, 
      firmId 
    } = options;

    const query: FilterQuery<IVehicle> = { isDeleted: false };

    if (search) {
      const normalizedSearch = search.replace(/[\s\-]/g, '').toUpperCase();
      query.$or = [
        { registrationNumber: { $regex: normalizedSearch, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { vehicleModel: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive;
    if (vehicleType) query.vehicleType = vehicleType;
    if (firmId) query.firmId = firmId;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      VehicleModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('firmId', 'name'),
      VehicleModel.countDocuments(query),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
