import { FirmModel, IFirm } from './firm.model';
import { CompanyModel } from '../companies/company.model';
import { NotFoundError, ConflictError } from '../../common/errors';
import { FilterQuery } from 'mongoose';

interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export class FirmService {
  static async create(data: Partial<IFirm>) {
    if (data.name) {
      const existing = await FirmModel.findOne({ 
        name: { $regex: new RegExp(`^${data.name}$`, 'i') }, 
        isDeleted: false 
      });
      if (existing) {
        throw new ConflictError('A firm with this name already exists');
      }
    }

    if (data.companyId) await this.assertCompanyExists(String(data.companyId));
    if (data.billPrefix) await this.assertBillPrefixAvailable(data.billPrefix);

    return FirmModel.create(data);
  }

  static async update(id: string, data: Partial<IFirm>) {
    const firm = await FirmModel.findOne({ _id: id, isDeleted: false });
    if (!firm) {
      throw new NotFoundError('Firm not found');
    }

    if (data.name && data.name !== firm.name) {
      const existing = await FirmModel.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existing) {
        throw new ConflictError('Another firm with this name already exists');
      }
    }

    if (data.companyId) await this.assertCompanyExists(String(data.companyId));
    if (data.billPrefix && data.billPrefix.toUpperCase() !== firm.billPrefix) {
      await this.assertBillPrefixAvailable(data.billPrefix, id);
    }

    Object.assign(firm, data);
    return firm.save();
  }

  private static async assertCompanyExists(companyId: string) {
    const company = await CompanyModel.findOne({ _id: companyId, isDeleted: false, isActive: true });
    if (!company) throw new NotFoundError('Company not found or inactive');
  }

  private static async assertBillPrefixAvailable(billPrefix: string, excludeId?: string) {
    const query: FilterQuery<IFirm> = {
      billPrefix: billPrefix.toUpperCase(),
      isDeleted: false,
    };
    if (excludeId) query._id = { $ne: excludeId };
    if (await FirmModel.findOne(query)) {
      throw new ConflictError('Another firm already uses this bill prefix');
    }
  }

  static async getById(id: string) {
    const firm = await FirmModel.findOne({ _id: id, isDeleted: false });
    if (!firm) {
      throw new NotFoundError('Firm not found');
    }
    return firm;
  }

  static async delete(id: string) {
    const firm = await FirmModel.findOne({ _id: id, isDeleted: false });
    if (!firm) {
      throw new NotFoundError('Firm not found');
    }

    firm.isDeleted = true;
    firm.isActive = false;
    await firm.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, search, isActive } = options;

    const query: FilterQuery<IFirm> = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { billingName: { $regex: search, $options: 'i' } },
        { 'contactDetails.name': { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      FirmModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FirmModel.countDocuments(query),
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
