import { Router } from 'express';
import { HsdRateController } from './hsd-rate.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { createHsdRateSchema, listHsdRateSchema, getHsdRateSchema, effectiveHsdRateSchema } from './hsd-rate.validation';

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createHsdRateSchema), HsdRateController.create);
router.get('/', validateResource(listHsdRateSchema), HsdRateController.list);
router.get('/effective', validateResource(effectiveHsdRateSchema), HsdRateController.getEffective);
router.get('/:id', validateResource(getHsdRateSchema), HsdRateController.getById);

export default router;
