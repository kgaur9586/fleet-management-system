import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../common/response';
import { env } from '../../config/env';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      
      sendSuccess(res, 200, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // In a stateless JWT implementation, logout is usually handled client-side
      // by deleting the token. We'll just return a success message.
      sendSuccess(res, 200, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await AuthService.getCurrentUser(userId);
      
      sendSuccess(res, 200, 'User retrieved successfully', { user });
    } catch (error) {
      next(error);
    }
  }

  static async seedOwner(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, adminSecret } = req.body;

      const user = await AuthService.seedInitialOwner(name, email, password, adminSecret, env.SEED_SECRET);

      sendSuccess(res, 201, 'Owner seeded successfully', { user });
    } catch (error) {
      next(error);
    }
  }
}
