import { FilterQuery } from 'mongoose';
import { CompanyModel, ICompany } from './company.model';
import { NotFoundError, ConflictError } from '../../common/errors';

interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class CompanyService {
  static async create(data: Partial<ICompany>) {
    if (data.name) await this.assertNameAvailable(data.name);
    return CompanyModel.create(data);
  }

  static async update(id: string, data: Partial<ICompany>) {
    const company = await this.requireCompany(id);
    if (data.name && data.name !== company.name) await this.assertNameAvailable(data.name, id);
    Object.assign(company, data);
    return company.save();
  }

  static async getById(id: string) {
    return this.requireCompany(id);
  }

  static async delete(id: string) {
    const company = await this.requireCompany(id);
    company.isDeleted = true;
    company.isActive = false;
    await company.save();
    return true;
  }

  static async list(options: QueryOptions) {
    const { page = 1, limit = 10, search, isActive } = options;
    const query: FilterQuery<ICompany> = { isDeleted: false };

    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ name: pattern }, { legalName: pattern }, { gstNumber: pattern }];
    }
    if (isActive !== undefined) query.isActive = isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CompanyModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      CompanyModel.countDocuments(query),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private static async requireCompany(id: string) {
    const company = await CompanyModel.findOne({ _id: id, isDeleted: false });
    if (!company) throw new NotFoundError('Company not found');
    return company;
  }

  private static async assertNameAvailable(name: string, excludeId?: string) {
    const query: FilterQuery<ICompany> = {
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      isDeleted: false,
    };
    if (excludeId) query._id = { $ne: excludeId };
    if (await CompanyModel.findOne(query)) {
      throw new ConflictError('A company with this name already exists');
    }
  }
}
