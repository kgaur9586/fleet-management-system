import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { TripController } from './trip.controller';
import { createTripSchema, getTripSchema, queryTripSchema, updateTripSchema } from './trip.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createTripSchema), TripController.create);
router.get('/', validateResource(queryTripSchema), TripController.list);
router.get('/:id', validateResource(getTripSchema), TripController.getById);
router.patch('/:id', validateResource(updateTripSchema), TripController.update);
router.delete('/:id', validateResource(getTripSchema), TripController.delete);

export default router;