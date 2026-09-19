import { Request, Response, NextFunction } from 'express';
import { DriverService } from './driver.service';
import { sendSuccess } from '../../common/response';

export class DriverController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await DriverService.create(req.body);
      sendSuccess(res, 201, 'Driver created successfully', driver);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const driver = await DriverService.update(id, req.body);
      sendSuccess(res, 200, 'Driver updated successfully', driver);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const driver = await DriverService.getById(id);
      sendSuccess(res, 200, 'Driver retrieved successfully', driver);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await DriverService.delete(id);
      sendSuccess(res, 200, 'Driver deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DriverService.list(req.query as any);
      sendSuccess(res, 200, 'Drivers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
