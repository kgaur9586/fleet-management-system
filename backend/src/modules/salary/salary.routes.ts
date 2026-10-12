import { Router } from 'express';
import { SalaryController } from './salary.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { generateSalarySchema, listSalarySchema, getSalarySchema, applyDeductionSchema, markPaidSchema } from './salary.validation';

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/generate', validateResource(generateSalarySchema), SalaryController.generate);
router.get('/', validateResource(listSalarySchema), SalaryController.list);
router.get('/:id', validateResource(getSalarySchema), SalaryController.getById);
router.patch('/:id/deduction', validateResource(applyDeductionSchema), SalaryController.applyDeduction);
router.patch('/:id/mark-paid', validateResource(markPaidSchema), SalaryController.markPaid);

export default router;
