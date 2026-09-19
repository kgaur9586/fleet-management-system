import { Router } from 'express';
import { FirmController } from './firm.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { 
  createFirmSchema, 
  updateFirmSchema, 
  getFirmSchema, 
  queryFirmSchema 
} from './firm.validation';

const router = Router();

// All firm routes require authentication and owner/admin role
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createFirmSchema), FirmController.create);
router.get('/', validateResource(queryFirmSchema), FirmController.list);
router.get('/:id', validateResource(getFirmSchema), FirmController.getById);
router.patch('/:id', validateResource(updateFirmSchema), FirmController.update);
router.delete('/:id', validateResource(getFirmSchema), FirmController.delete);

export default router;
