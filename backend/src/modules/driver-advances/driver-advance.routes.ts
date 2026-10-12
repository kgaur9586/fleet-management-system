import { Router } from 'express';
import { DriverAdvanceController } from './driver-advance.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth, requireRole } from '../../middleware/auth';
import { createDriverAdvanceSchema, listDriverAdvanceSchema, getDriverAdvanceSchema } from './driver-advance.validation';
import { z } from 'zod';
import mongoose from 'mongoose';

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));

const driverIdParamSchema = z.object({
  params: z.object({ driverId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' }) }),
});

router.post('/', validateResource(createDriverAdvanceSchema), DriverAdvanceController.create);
router.get('/', validateResource(listDriverAdvanceSchema), DriverAdvanceController.list);
router.get('/driver/:driverId/outstanding', validateResource(driverIdParamSchema), DriverAdvanceController.outstandingTotal);
router.get('/:id', validateResource(getDriverAdvanceSchema), DriverAdvanceController.getById);

export default router;
