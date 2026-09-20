import { Router } from 'express';
import { InvoiceController } from './invoice.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { generateInvoiceSchema, queryInvoiceSchema, getInvoiceSchema, invoiceTransitionSchema } from './invoice.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/generate', validateResource(generateInvoiceSchema), InvoiceController.generate);
router.get('/', validateResource(queryInvoiceSchema), InvoiceController.list);
router.get('/:id', validateResource(getInvoiceSchema), InvoiceController.getById);
router.patch('/:id/approve', validateResource(invoiceTransitionSchema), InvoiceController.approve);
router.patch('/:id/finalize', validateResource(invoiceTransitionSchema), InvoiceController.finalize);
router.get('/:id/pdf', validateResource(getInvoiceSchema), InvoiceController.downloadPdf);

export default router;
