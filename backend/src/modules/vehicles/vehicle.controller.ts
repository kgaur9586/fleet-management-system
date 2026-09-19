import { Request, Response, NextFunction } from 'express';
import { VehicleService } from './vehicle.service';
import { sendSuccess } from '../../common/response';

export class VehicleController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await VehicleService.create(req.body);
      sendSuccess(res, 201, 'Vehicle created successfully', vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const vehicle = await VehicleService.update(id, req.body);
      sendSuccess(res, 200, 'Vehicle updated successfully', vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const vehicle = await VehicleService.getById(id);
      sendSuccess(res, 200, 'Vehicle retrieved successfully', vehicle);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await VehicleService.delete(id);
      sendSuccess(res, 200, 'Vehicle deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await VehicleService.list(req.query as any);
      sendSuccess(res, 200, 'Vehicles retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
