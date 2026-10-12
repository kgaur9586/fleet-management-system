import { Request, Response, NextFunction } from 'express';
import { SalaryService } from './salary.service';
import { sendSuccess } from '../../common/response';

export class SalaryController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await SalaryService.generate({ ...req.body, createdBy: req.user?.id });
      sendSuccess(res, 201, 'Salary record generated successfully', record);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalaryService.list(req.query as any);
      sendSuccess(res, 200, 'Salary records retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalaryService.getById(req.params.id as string);
      sendSuccess(res, 200, 'Salary record retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async applyDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalaryService.applyAdvanceDeduction(req.params.id as string, req.body.amount, req.user?.id);
      sendSuccess(res, 200, 'Advance deduction applied successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async setOtherDeductions(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await SalaryService.setOtherDeductions(req.params.id as string, req.body.amount, req.user?.id);
      sendSuccess(res, 200, 'Other deductions updated successfully', record);
    } catch (error) {
      next(error);
    }
  }

  static async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await SalaryService.markPaid(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, 200, 'Salary record marked as paid', record);
    } catch (error) {
      next(error);
    }
  }
}
