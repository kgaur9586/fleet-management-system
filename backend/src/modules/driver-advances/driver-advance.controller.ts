import { Request, Response, NextFunction } from 'express';
import { DriverAdvanceService } from './driver-advance.service';
import { AuditService } from '../audit/audit.service';
import { sendSuccess } from '../../common/response';

export class DriverAdvanceController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const advance = await DriverAdvanceService.create({ ...req.body, createdBy: req.user?.id });
      await AuditService.record({
        action: 'driver_advance.created',
        entityType: 'driver_advance',
        entityId: advance._id as any,
        userId: req.user?.id,
        changes: { after: { driverId: req.body.driverId, amount: req.body.amount } },
      });
      sendSuccess(res, 201, 'Driver advance recorded successfully', advance);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DriverAdvanceService.list(req.query as any);
      sendSuccess(res, 200, 'Driver advances retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DriverAdvanceService.getById(req.params.id as string);
      sendSuccess(res, 200, 'Driver advance retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async outstandingTotal(req: Request, res: Response, next: NextFunction) {
    try {
      const total = await DriverAdvanceService.getOutstandingTotal(req.params.driverId as string);
      sendSuccess(res, 200, 'Outstanding advance balance retrieved successfully', { driverId: req.params.driverId, outstandingAmount: total });
    } catch (error) {
      next(error);
    }
  }
}
