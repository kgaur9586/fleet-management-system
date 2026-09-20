import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/response';
import { ContractService } from './contract.service';

export class ContractController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 201, 'Contract created successfully', await ContractService.create(req.body)); } catch (error) { next(error); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 200, 'Contract updated successfully', await ContractService.update(req.params.id as string, req.body)); } catch (error) { next(error); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 200, 'Contract retrieved successfully', await ContractService.getById(req.params.id as string)); } catch (error) { next(error); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try { await ContractService.delete(req.params.id as string); sendSuccess(res, 200, 'Contract deactivated successfully'); } catch (error) { next(error); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Contracts retrieved successfully', await ContractService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        firmId: req.query.firmId as string | undefined,
        companyId: req.query.companyId as string | undefined,
        isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      }));
    } catch (error) { next(error); }
  }

  static async createVersion(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 201, 'Contract version created successfully', await ContractService.createVersion(req.params.id as string, req.body)); } catch (error) { next(error); }
  }

  static async listVersions(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 200, 'Contract versions retrieved successfully', await ContractService.listVersions(req.params.id as string)); } catch (error) { next(error); }
  }

  static async getVersion(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 200, 'Contract version retrieved successfully', await ContractService.getVersion(req.params.id as string, req.params.versionId as string)); } catch (error) { next(error); }
  }

  static async getEffectiveVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      sendSuccess(res, 200, 'Effective contract version retrieved successfully', await ContractService.getEffectiveVersion(req.params.id as string, date));
    } catch (error) { next(error); }
  }

  static async getActiveVersion(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, 200, 'Active contract version retrieved successfully', await ContractService.getActiveVersion(req.params.id as string)); } catch (error) { next(error); }
  }
}