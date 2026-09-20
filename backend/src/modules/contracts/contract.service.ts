import { FilterQuery } from 'mongoose';
import { ConflictError, NotFoundError } from '../../common/errors';
import { ContractModel, IContract } from './contract.model';
import { ContractVersionModel, IContractVersion } from './contract-version.model';

interface ContractQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  firmId?: string;
  companyId?: string;
  isActive?: boolean;
}

interface VersionInput {
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  billingRules: IContractVersion['billingRules'];
  notes?: string;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class ContractService {
  static async create(data: Partial<IContract>) {
    const existing = await ContractModel.findOne({
      firmId: data.firmId,
      companyId: data.companyId ?? null,
      name: { $regex: new RegExp(`^${escapeRegex(data.name ?? '')}$`, 'i') },
      isDeleted: false,
    });
    if (existing) throw new ConflictError('A contract with this name already exists for the firm and customer');
    return ContractModel.create(data);
  }

  static async update(id: string, data: Partial<IContract>) {
    const contract = await this.requireContract(id);
    if (data.name && data.name.toLowerCase() !== contract.name.toLowerCase()) {
      const existing = await ContractModel.findOne({
        _id: { $ne: id }, firmId: contract.firmId, companyId: data.companyId ?? contract.companyId ?? null,
        name: { $regex: new RegExp(`^${escapeRegex(data.name)}$`, 'i') }, isDeleted: false,
      });
      if (existing) throw new ConflictError('Another contract with this name already exists');
    }
    Object.assign(contract, data);
    return contract.save();
  }

  static async getById(id: string) {
    return this.requireContract(id);
  }

  static async delete(id: string) {
    const contract = await this.requireContract(id);
    contract.isDeleted = true;
    contract.isActive = false;
    await contract.save();
    return true;
  }

  static async list(options: ContractQueryOptions) {
    const { page = 1, limit = 10, search, firmId, companyId, isActive } = options;
    const query: FilterQuery<IContract> = { isDeleted: false };
    if (search) query.$or = [
      { name: { $regex: escapeRegex(search), $options: 'i' } },
      { description: { $regex: escapeRegex(search), $options: 'i' } },
    ];
    if (firmId) query.firmId = firmId;
    if (companyId) query.companyId = companyId;
    if (isActive !== undefined) query.isActive = isActive;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ContractModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ContractModel.countDocuments(query),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async createVersion(contractId: string, data: VersionInput) {
    await this.requireContract(contractId);
    if (data.effectiveTo && data.effectiveTo <= data.effectiveFrom) {
      throw new ConflictError('Effective end date must be after the start date');
    }
    const overlap = await this.findOverlappingVersion(contractId, data.effectiveFrom, data.effectiveTo);
    if (overlap) throw new ConflictError('The effective date range overlaps an existing contract version');
    const lastVersion = await ContractVersionModel.findOne({ contractId }).sort({ version: -1 });
    return ContractVersionModel.create({ ...data, contractId, version: (lastVersion?.version ?? 0) + 1 });
  }

  static async listVersions(contractId: string) {
    await this.requireContract(contractId);
    return ContractVersionModel.find({ contractId }).sort({ effectiveFrom: -1 });
  }

  static async getVersion(contractId: string, versionId: string) {
    const version = await ContractVersionModel.findOne({ _id: versionId, contractId });
    if (!version) throw new NotFoundError('Contract version not found');
    return version;
  }

  static async getEffectiveVersion(contractId: string, tripDate: Date) {
    await this.requireContract(contractId);
    const version = await ContractVersionModel.findOne({
      contractId,
      effectiveFrom: { $lte: tripDate },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: tripDate } }],
    }).sort({ effectiveFrom: -1 });
    if (!version) throw new NotFoundError('No contract version is effective for the requested date');
    return version;
  }

  static async getActiveVersion(contractId: string) {
    const contract = await ContractModel.findOne({ _id: contractId, isDeleted: false, isActive: true });
    if (!contract) throw new NotFoundError('Active contract not found');
    return this.getEffectiveVersion(contractId, new Date());
  }

  private static async findOverlappingVersion(contractId: string, from: Date, to?: Date | null) {
    const query: FilterQuery<IContractVersion> = {
      contractId,
      effectiveFrom: to ? { $lt: to } : { $exists: true },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: from } }],
    };
    return ContractVersionModel.findOne(query);
  }

  private static async requireContract(id: string) {
    const contract = await ContractModel.findOne({ _id: id, isDeleted: false });
    if (!contract) throw new NotFoundError('Contract not found');
    return contract;
  }
}