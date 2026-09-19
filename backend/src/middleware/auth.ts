import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../common/errors';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { logger } from '../config/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();
  } catch (error: any) {
    logger.warn(`Authentication failed: ${error.message}`);
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`Authorization failed for user ${req.user.id}: Required one of ${allowedRoles.join(',')}, but got ${req.user.role}`);
        throw new ForbiddenError('You do not have permission to perform this action');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
