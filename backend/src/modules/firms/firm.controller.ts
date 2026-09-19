import { Request, Response, NextFunction } from 'express';
import { FirmService } from './firm.service';
import { sendSuccess } from '../../common/response';

export class FirmController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const firm = await FirmService.create(req.body);
      sendSuccess(res, 201, 'Firm created successfully', firm);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const firm = await FirmService.update(id, req.body);
      sendSuccess(res, 200, 'Firm updated successfully', firm);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const firm = await FirmService.getById(id);
      sendSuccess(res, 200, 'Firm retrieved successfully', firm);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await FirmService.delete(id);
      sendSuccess(res, 200, 'Firm deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FirmService.list(req.query as any);
      sendSuccess(res, 200, 'Firms retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
