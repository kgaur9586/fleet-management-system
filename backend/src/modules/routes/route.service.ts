import { RouteModel, IRoute } from './route.model';
import { NotFoundError, ConflictError } from '../../common/errors';
import { FilterQuery } from 'mongoose';

interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export class RouteService {
  static async create(data: Partial<IRoute>) {
    if (data.name) {
      const existing = await RouteModel.findOne({ 
        name: { $regex: new RegExp(`^${data.name}$`, 'i') }, 
        isDeleted: false 
      });
      if (existing) {
        throw new ConflictError('A route with this name already exists');
      }
    }

    if (data.routeCode) {
      const existingCode = await RouteModel.findOne({
        routeCode: data.routeCode,
        isDeleted: false
      });
      if (existingCode) {
        throw new ConflictError('A route with this code already exists');
      }
    }

    return RouteModel.create(data);
  }

  static async update(id: string, data: Partial<IRoute>) {
    const routeInfo = await RouteModel.findOne({ _id: id, isDeleted: false });
    if (!routeInfo) {
      throw new NotFoundError('Route not found');
    }

    if (data.name && data.name !== routeInfo.name) {
      const existing = await RouteModel.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existing) {
        throw new ConflictError('Another route with this name already exists');
      }
    }

    if (data.routeCode && data.routeCode !== routeInfo.routeCode) {
      const existingCode = await RouteModel.findOne({
        routeCode: data.routeCode,
        _id: { $ne: id },
        isDeleted: false
      });
      if (existingCode) {
        throw new ConflictError('Another route with this code already exists');
      }
    }

    Object.assign(routeInfo, data);
    return routeInfo.save();
  }

  static async getById(id: string) {
    const routeInfo = await RouteModel.findOne({ _id: id, isDeleted: false });
    if (!routeInfo) {
      throw new NotFoundError('Route not found');
    }
    return routeInfo;
  }

  static async delete(id: string) {
    const routeInfo = await RouteModel.findOne({ _id: id, isDeleted: false });
    if (!routeInfo) {
      throw new NotFoundError('Route not found');
    }

    routeInfo.isDeleted = true;
    routeInfo.isActive = false;
    await routeInfo.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, search, isActive } = options;

    const query: FilterQuery<IRoute> = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { routeCode: { $regex: search, $options: 'i' } },
        { pickupLocation: { $regex: search, $options: 'i' } },
        { dropLocation: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      RouteModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      RouteModel.countDocuments(query),
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
