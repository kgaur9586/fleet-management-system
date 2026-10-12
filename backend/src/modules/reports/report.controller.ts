import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service';
import { sendSuccess } from '../../common/response';

export class ReportController {
  static async vehicleRevenue(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.vehicleRevenue(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Vehicle revenue report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async firmBilling(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.firmBilling(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Firm billing report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async expenseSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportService.expenseSummary(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Expense summary report retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async billRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.billRegister({
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        firmId: req.query.firmId as string | undefined,
        status: req.query.status as string | undefined,
      });
      sendSuccess(res, 200, 'Bill register retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async firmReceivables(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportService.firmReceivables(req.params.firmId as string);
      sendSuccess(res, 200, 'Firm receivables report retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async tripCountAndKm(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.tripCountAndKm(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Trip count and KM report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async fuelVsHsd(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.fuelVsHsd(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Fuel vs contractual HSD report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async tollVariance(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.tollVariance(Number(req.query.month), Number(req.query.year));
      sendSuccess(res, 200, 'Toll variance report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async maintenanceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.maintenanceHistory({
        vehicleId: req.query.vehicleId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });
      sendSuccess(res, 200, 'Maintenance history retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async documentExpiry(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.documentExpiry({
        vehicleId: req.query.vehicleId as string | undefined,
        documentType: req.query.documentType as string | undefined,
      });
      sendSuccess(res, 200, 'Document expiry report retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }

  static async driverWageSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await ReportService.driverWageSummary({
        driverId: req.query.driverId as string | undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
      });
      sendSuccess(res, 200, 'Driver wage summary retrieved successfully', rows);
    } catch (error) {
      next(error);
    }
  }
}
