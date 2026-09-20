import { Request, Response, NextFunction } from 'express';
import { RouteService } from './route.service';
import { sendSuccess } from '../../common/response';

export class RouteController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const routeInfo = await RouteService.create(req.body);
      sendSuccess(res, 201, 'Route created successfully', routeInfo);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const routeInfo = await RouteService.update(id, req.body);
      sendSuccess(res, 200, 'Route updated successfully', routeInfo);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const routeInfo = await RouteService.getById(id);
      sendSuccess(res, 200, 'Route retrieved successfully', routeInfo);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await RouteService.delete(id);
      sendSuccess(res, 200, 'Route deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RouteService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      });
      sendSuccess(res, 200, 'Routes retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
