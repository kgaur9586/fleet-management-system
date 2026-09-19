import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/errors';
import { sendError } from '../common/response';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    logger.warn(`Validation error: ${JSON.stringify(formattedErrors)}`);
    return sendError(res, 400, 'Validation failed', formattedErrors);
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`[Non-Operational Error] ${err.message}`, err.stack);
    } else {
      logger.warn(`[Operational Error] ${err.message}`);
    }
    return sendError(res, err.statusCode, err.message);
  }

  // Handle Mongoose duplicate key error
  if ((err as any).code === 11000) {
    logger.warn(`Duplicate key error: ${err.message}`);
    return sendError(res, 409, 'Duplicate entry found');
  }

  logger.error(`[Unhandled Error] ${err.message}`, err.stack);
  return sendError(res, 500, 'Internal Server Error');
};
