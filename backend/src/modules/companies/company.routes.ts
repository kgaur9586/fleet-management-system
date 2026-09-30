import { Router } from 'express';
import { CompanyController } from './company.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  createCompanySchema,
  updateCompanySchema,
  getCompanySchema,
  queryCompanySchema,
} from './company.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createCompanySchema), CompanyController.create);
router.get('/', validateResource(queryCompanySchema), CompanyController.list);
router.get('/:id', validateResource(getCompanySchema), CompanyController.getById);
router.patch('/:id', validateResource(updateCompanySchema), CompanyController.update);
router.delete('/:id', validateResource(getCompanySchema), CompanyController.delete);

export default router;
