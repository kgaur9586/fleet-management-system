import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { DashboardController } from './dashboard.controller';
import { dashboardQuerySchema } from './dashboard.validation';

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));
router.get('/', validateResource(dashboardQuerySchema), DashboardController.getSnapshot);

export default router;
