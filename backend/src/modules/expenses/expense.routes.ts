import { Router } from 'express';
import { ExpenseController } from './expense.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { createExpenseSchema, getExpenseSchema, queryExpenseSchema, summaryExpenseSchema, updateExpenseSchema } from './expense.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createExpenseSchema), ExpenseController.create);
router.get('/summary', validateResource(summaryExpenseSchema), ExpenseController.summary);
router.get('/', validateResource(queryExpenseSchema), ExpenseController.list);
router.get('/:id', validateResource(getExpenseSchema), ExpenseController.getById);
router.patch('/:id', validateResource(updateExpenseSchema), ExpenseController.update);
router.delete('/:id', validateResource(getExpenseSchema), ExpenseController.delete);

export default router;
