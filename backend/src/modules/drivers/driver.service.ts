import { DriverModel, IDriver } from './driver.model';
import { NotFoundError, ConflictError } from '../../common/errors';
import { FilterQuery } from 'mongoose';

interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export class DriverService {
  static async create(data: Partial<IDriver>) {
    // Check mobile uniqueness
    if (data.mobile) {
      const existing = await DriverModel.findOne({ mobile: data.mobile, isDeleted: false });
      if (existing) {
        throw new ConflictError('A driver with this mobile number already exists');
      }
    }

    // Check employeeId uniqueness if provided
    if (data.employeeId) {
      const existing = await DriverModel.findOne({ employeeId: data.employeeId, isDeleted: false });
      if (existing) {
        throw new ConflictError('A driver with this employee ID already exists');
      }
    }

    return DriverModel.create(data);
  }

  static async update(id: string, data: Partial<IDriver>) {
    const driver = await DriverModel.findOne({ _id: id, isDeleted: false });
    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    if (data.mobile && data.mobile !== driver.mobile) {
      const existing = await DriverModel.findOne({
        mobile: data.mobile,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existing) {
        throw new ConflictError('Another driver with this mobile number already exists');
      }
    }

    if (data.employeeId && data.employeeId !== driver.employeeId) {
      const existing = await DriverModel.findOne({
        employeeId: data.employeeId,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existing) {
        throw new ConflictError('Another driver with this employee ID already exists');
      }
    }

    // If a new history event is passed instead of full history replacement, one could handle it here.
    // For now, if history is passed, it overwrites. A production app might want an `addHistoryEvent` specific endpoint.
    
    Object.assign(driver, data);
    return driver.save();
  }

  static async getById(id: string) {
    const driver = await DriverModel.findOne({ _id: id, isDeleted: false });
    if (!driver) {
      throw new NotFoundError('Driver not found');
    }
    return driver;
  }

  static async delete(id: string) {
    const driver = await DriverModel.findOne({ _id: id, isDeleted: false });
    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    driver.isDeleted = true;
    driver.isActive = false;
    
    // Add termination event to history
    driver.history.push({
      eventType: 'terminated',
      date: new Date(),
      notes: 'Soft deleted from system'
    });
    
    await driver.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, search, isActive } = options;

    const query: FilterQuery<IDriver> = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      DriverModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DriverModel.countDocuments(query),
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
