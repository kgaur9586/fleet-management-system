import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth } from '../../middleware/auth';
import { loginSchema, seedOwnerSchema } from './auth.validation';

const router = Router();

// Public routes
router.post('/login', validateResource(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);

// Seed route - ideally protected by a secret key
router.post('/seed', validateResource(seedOwnerSchema), AuthController.seedOwner);

// Protected routes
router.get('/me', requireAuth, AuthController.getCurrentUser);

export default router;
