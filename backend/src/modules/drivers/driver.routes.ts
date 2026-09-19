import { Router } from 'express';
import { DriverController } from './driver.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { 
  createDriverSchema, 
  updateDriverSchema, 
  getDriverSchema, 
  queryDriverSchema 
} from './driver.validation';

const router = Router();

// All driver routes require authentication and owner/admin role
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createDriverSchema), DriverController.create);
router.get('/', validateResource(queryDriverSchema), DriverController.list);
router.get('/:id', validateResource(getDriverSchema), DriverController.getById);
router.patch('/:id', validateResource(updateDriverSchema), DriverController.update);
router.delete('/:id', validateResource(getDriverSchema), DriverController.delete);

export default router;
