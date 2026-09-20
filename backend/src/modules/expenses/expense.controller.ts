import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from './expense.service';
import { sendSuccess } from '../../common/response';

export class ExpenseController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await ExpenseService.create({
        ...req.body,
        createdBy: req.user?.id,
      });
      sendSuccess(res, 201, 'Expense created successfully', created);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await ExpenseService.update(id, req.body);
      sendSuccess(res, 200, 'Expense updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const expense = await ExpenseService.getById(id);
      sendSuccess(res, 200, 'Expense retrieved successfully', expense);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await ExpenseService.delete(id);
      sendSuccess(res, 200, 'Expense deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ExpenseService.list(req.query as any);
      sendSuccess(res, 200, 'Expenses retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ExpenseService.getSummary(
        req.query.month ? Number(req.query.month) : undefined,
        req.query.year ? Number(req.query.year) : undefined
      );
      sendSuccess(res, 200, 'Expense summary retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
