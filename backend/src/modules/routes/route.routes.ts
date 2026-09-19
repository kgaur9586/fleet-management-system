import { Router } from 'express';
import { RouteController } from './route.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { 
  createRouteSchema, 
  updateRouteSchema, 
  getRouteSchema, 
  queryRouteSchema 
} from './route.validation';

const router = Router();

// All routes require authentication and owner/admin role
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createRouteSchema), RouteController.create);
router.get('/', validateResource(queryRouteSchema), RouteController.list);
router.get('/:id', validateResource(getRouteSchema), RouteController.getById);
router.patch('/:id', validateResource(updateRouteSchema), RouteController.update);
router.delete('/:id', validateResource(getRouteSchema), RouteController.delete);

export default router;
