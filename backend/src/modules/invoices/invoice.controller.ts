import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/response';
import { InvoiceService } from './invoice.service';

export class InvoiceController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoiceService.generate({
        firmId: req.body.firmId,
        vehicleId: req.body.vehicleId,
        month: req.body.month,
        year: req.body.year,
        notes: req.body.notes,
      }, req.user?.id);
      sendSuccess(res, 201, 'Invoice generated successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InvoiceService.list({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        firmId: req.query.firmId as string | undefined,
        vehicleId: req.query.vehicleId as string | undefined,
        status: req.query.status as any,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
      });
      sendSuccess(res, 200, 'Invoices retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, 200, 'Invoice retrieved successfully', await InvoiceService.getById(req.params.id as string));
    } catch (error) {
      next(error);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoiceService.approve(req.params.id as string, { notes: req.body.notes }, req.user?.id);
      sendSuccess(res, 200, 'Invoice approved successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoiceService.reopen(req.params.id as string, req.body.reason, req.user?.id);
      sendSuccess(res, 200, 'Invoice reopened successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async history(req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await InvoiceService.history(req.params.id as string);
      sendSuccess(res, 200, 'Invoice history retrieved successfully', entries);
    } catch (error) {
      next(error);
    }
  }

  static async finalize(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await InvoiceService.finalize(req.params.id as string, { notes: req.body.notes }, req.user?.id);
      sendSuccess(res, 200, 'Invoice finalized successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoice, content } = await InvoiceService.getFinalizedPdf(req.params.id as string);
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber ?? `invoice-${invoice._id}`}.pdf"`);
      res.setHeader('Content-Length', content.length);
      res.send(content);
    } catch (error) {
      next(error);
    }
  }
}
