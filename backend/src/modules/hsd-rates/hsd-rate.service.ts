import { HsdRateModel, IHsdRate } from './hsd-rate.model';
import { NotFoundError, ConflictError } from '../../common/errors';
import { toNumber } from '../../common/decimal';

interface CreateHsdRateInput {
  ratePerLitre: number;
  effectiveFrom: Date;
  notes?: string;
  createdBy: string;
}

export class HsdRateService {
  static async create(data: CreateHsdRateInput) {
    const existing = await HsdRateModel.findOne({ effectiveFrom: data.effectiveFrom });
    if (existing) throw new ConflictError('A rate is already recorded for this effective date');

    return HsdRateModel.create({
      ratePerLitre: data.ratePerLitre,
      effectiveFrom: data.effectiveFrom,
      notes: data.notes,
      createdBy: data.createdBy,
    });
  }

  static async list(options: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HsdRateModel.find().sort({ effectiveFrom: -1 }).skip(skip).limit(limit),
      HsdRateModel.countDocuments(),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getById(id: string) {
    const rate = await HsdRateModel.findById(id);
    if (!rate) throw new NotFoundError('HSD rate not found');
    return rate;
  }

  /** The most recently effective rate on or before `date`; later entries bound earlier ones implicitly. */
  static async getEffectiveRate(date: Date) {
    return HsdRateModel.findOne({ effectiveFrom: { $lte: date } }).sort({ effectiveFrom: -1 });
  }

  static async getActiveRate() {
    return this.getEffectiveRate(new Date());
  }

  /** Returns the global rate for `date`, or `undefined` if none is configured yet. */
  static async resolveRateForDate(date: Date): Promise<number | undefined> {
    const rate = await this.getEffectiveRate(date);
    return rate ? toNumber(rate.ratePerLitre) : undefined;
  }
}
