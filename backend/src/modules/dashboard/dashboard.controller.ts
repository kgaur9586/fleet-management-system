import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/response';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  static async getSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const month = req.query.month ? Number(req.query.month) : undefined;
      const year = req.query.year ? Number(req.query.year) : undefined;
      sendSuccess(res, 200, 'Dashboard snapshot retrieved successfully', await DashboardService.getSnapshot(month, year));
    } catch (error) {
      next(error);
    }
  }
}
