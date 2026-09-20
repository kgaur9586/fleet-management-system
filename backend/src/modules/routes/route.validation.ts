import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const createRouteSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Route name must be at least 2 characters'),
    routeCode: z.string().trim().min(1, 'Route code cannot be empty').optional(),
    pickupLocation: z.string().trim().min(2, 'Pickup location is required'),
    dropLocation: z.string().trim().min(2, 'Drop location is required'),
    intermediateStops: z.array(z.string().trim().min(1, 'Intermediate stops cannot be empty')).optional(),
    expectedDistanceKm: z.number().finite().min(0, 'Distance must be positive').optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const updateRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    routeCode: z.string().trim().min(1, 'Route code cannot be empty').optional(),
    pickupLocation: z.string().trim().min(2).optional(),
    dropLocation: z.string().trim().min(2).optional(),
    intermediateStops: z.array(z.string().trim().min(1, 'Intermediate stops cannot be empty')).optional(),
    expectedDistanceKm: z.number().finite().min(0).optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const getRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryRouteSchema = z.object({
  query: z.object({
    page: z.string().regex(/^[1-9]\d*$/, 'Page must be a positive integer').transform(Number).refine((value) => value <= 100000, 'Page is too large').optional(),
    limit: z.string().regex(/^[1-9]\d*$/, 'Limit must be a positive integer').transform(Number).refine((value) => value <= 100, 'Limit cannot exceed 100').optional(),
    search: z.string().trim().optional(),
    isActive: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  }),
});
