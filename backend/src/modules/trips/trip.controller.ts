import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/response';
import { TripService } from './trip.service';

export class TripController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 201, 'Trip created successfully', await TripService.create(req.body));
    } catch (error) { next(error); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Trip updated successfully', await TripService.update(req.params.id as string, req.body));
    } catch (error) { next(error); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Trip retrieved successfully', await TripService.getById(req.params.id as string));
    } catch (error) { next(error); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await TripService.delete(req.params.id as string);
      sendSuccess(res, 200, 'Trip cancelled successfully');
    } catch (error) { next(error); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Trips retrieved successfully', await TripService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        month: req.query.month as string | undefined,
        vehicleId: req.query.vehicleId as string | undefined,
        driverId: req.query.driverId as string | undefined,
        firmId: req.query.firmId as string | undefined,
        operationalStatus: req.query.operationalStatus as any,
      }));
    } catch (error) { next(error); }
  }
}