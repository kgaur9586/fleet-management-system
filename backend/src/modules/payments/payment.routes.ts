import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { PaymentController } from './payment.controller';
import { createPaymentSchema, listPaymentSchema, paymentSummarySchema } from './payment.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));
router.post('/', validateResource(createPaymentSchema), PaymentController.create);
router.get('/summary', validateResource(paymentSummarySchema), PaymentController.summary);
router.get('/', validateResource(listPaymentSchema), PaymentController.list);

export default router;
