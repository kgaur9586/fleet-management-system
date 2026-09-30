import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { validateResource } from '../../middleware/validateResource';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../config/env';
import { loginSchema, seedOwnerSchema } from './auth.validation';

const router = Router();

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 0 : 10,
  skip: () => env.NODE_ENV === 'test',
  message: 'Too many authentication attempts from this IP, please try again later.',
});

// Public routes
router.post('/login', credentialLimiter, validateResource(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);

// Bootstrap route - guarded by SEED_SECRET and only usable while no owner exists
router.post('/seed', credentialLimiter, validateResource(seedOwnerSchema), AuthController.seedOwner);

// Protected routes
router.get('/me', requireAuth, AuthController.getCurrentUser);

export default router;
