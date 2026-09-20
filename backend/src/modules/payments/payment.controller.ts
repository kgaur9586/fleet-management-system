import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/response';
import { PaymentService } from './payment.service';

export class PaymentController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.create({ ...req.body, createdBy: req.user?.id });
      sendSuccess(res, 201, 'Payment recorded successfully', payment);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Payment history retrieved successfully', await PaymentService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        invoiceId: req.query.invoiceId as string | undefined,
        firmId: req.query.firmId as string | undefined,
        status: req.query.status as any,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      }));
    } catch (error) {
      next(error);
    }
  }

  static async summary(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Payment summary retrieved successfully', await PaymentService.summary({
        firmId: req.query.firmId as string | undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
      }));
    } catch (error) {
      next(error);
    }
  }
}
