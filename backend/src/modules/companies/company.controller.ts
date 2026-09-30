import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { sendSuccess } from '../../common/response';

export class CompanyController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompanyService.create(req.body);
      sendSuccess(res, 201, 'Company created successfully', company);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompanyService.update(req.params.id as string, req.body);
      sendSuccess(res, 200, 'Company updated successfully', company);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompanyService.getById(req.params.id as string);
      sendSuccess(res, 200, 'Company retrieved successfully', company);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await CompanyService.delete(req.params.id as string);
      sendSuccess(res, 200, 'Company deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CompanyService.list(req.query as any);
      sendSuccess(res, 200, 'Companies retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
