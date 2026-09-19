import { Router } from 'express';
import { VehicleController } from './vehicle.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { 
  createVehicleSchema, 
  updateVehicleSchema, 
  getVehicleSchema, 
  queryVehicleSchema 
} from './vehicle.validation';

const router = Router();

// All vehicle routes require authentication and owner/admin role
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createVehicleSchema), VehicleController.create);
router.get('/', validateResource(queryVehicleSchema), VehicleController.list);
router.get('/:id', validateResource(getVehicleSchema), VehicleController.getById);
router.patch('/:id', validateResource(updateVehicleSchema), VehicleController.update);
router.delete('/:id', validateResource(getVehicleSchema), VehicleController.delete);

export default router;
