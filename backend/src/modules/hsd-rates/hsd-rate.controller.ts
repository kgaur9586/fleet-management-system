import { Request, Response, NextFunction } from 'express';
import { HsdRateService } from './hsd-rate.service';
import { sendSuccess } from '../../common/response';

export class HsdRateController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const rate = await HsdRateService.create({ ...req.body, createdBy: req.user?.id });
      sendSuccess(res, 201, 'HSD rate recorded successfully', rate);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await HsdRateService.list(req.query as any);
      sendSuccess(res, 200, 'HSD rates retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const rate = await HsdRateService.getById(req.params.id as string);
      sendSuccess(res, 200, 'HSD rate retrieved successfully', rate);
    } catch (error) {
      next(error);
    }
  }

  static async getEffective(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const rate = await HsdRateService.getEffectiveRate(date);
      sendSuccess(res, 200, 'Effective HSD rate retrieved successfully', rate);
    } catch (error) {
      next(error);
    }
  }
}
