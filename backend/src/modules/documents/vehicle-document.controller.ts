import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../../common/errors';
import { sendSuccess } from '../../common/response';
import { VehicleDocumentService } from './vehicle-document.service';

export class VehicleDocumentController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 201, 'Vehicle document created successfully', await VehicleDocumentService.create({ ...req.body, createdBy: req.user?.id }));
    } catch (error) {
      next(error);
    }
  }

  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new BadRequestError('A document file is required');
      sendSuccess(res, 201, 'Vehicle document uploaded successfully', await VehicleDocumentService.upload({ ...req.body, createdBy: req.user?.id }, req.file));
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Vehicle documents retrieved successfully', await VehicleDocumentService.list({
        vehicleId: req.query.vehicleId as string | undefined,
        documentType: req.query.documentType as any,
        status: req.query.status as any,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Vehicle document retrieved successfully', await VehicleDocumentService.getById(req.params.id as string));
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const { document, file } = await VehicleDocumentService.getFile(req.params.id as string);
      res.status(200);
      res.setHeader('Content-Type', document.contentType ?? file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName ?? 'vehicle-document'}"`);
      res.setHeader('Content-Length', file.content.length);
      res.send(file.content);
    } catch (error) {
      next(error);
    }
  }
}
