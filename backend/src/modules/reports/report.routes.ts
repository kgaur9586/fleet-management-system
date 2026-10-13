import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { ReportController } from './report.controller';
import { monthlyReportSchema, billRegisterSchema, firmReceivablesSchema, maintenanceHistorySchema, documentExpirySchema, driverWageSummarySchema } from './report.validation';

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));

router.get('/vehicle-revenue', validateResource(monthlyReportSchema), ReportController.vehicleRevenue);
router.get('/firm-billing', validateResource(monthlyReportSchema), ReportController.firmBilling);
router.get('/expense-summary', validateResource(monthlyReportSchema), ReportController.expenseSummary);
router.get('/bill-register', validateResource(billRegisterSchema), ReportController.billRegister);
router.get('/firm-receivables/:firmId', validateResource(firmReceivablesSchema), ReportController.firmReceivables);
router.get('/trip-km', validateResource(monthlyReportSchema), ReportController.tripCountAndKm);
router.get('/fuel-vs-hsd', validateResource(monthlyReportSchema), ReportController.fuelVsHsd);
router.get('/toll-variance', validateResource(monthlyReportSchema), ReportController.tollVariance);
router.get('/maintenance-history', validateResource(maintenanceHistorySchema), ReportController.maintenanceHistory);
router.get('/document-expiry', validateResource(documentExpirySchema), ReportController.documentExpiry);
router.get('/driver-wage-summary', validateResource(driverWageSummarySchema), ReportController.driverWageSummary);

export default router;
