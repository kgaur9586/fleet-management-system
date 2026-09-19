import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const createRouteSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Route name must be at least 2 characters'),
    routeCode: z.string().optional(),
    pickupLocation: z.string().min(2, 'Pickup location is required'),
    dropLocation: z.string().min(2, 'Drop location is required'),
    intermediateStops: z.array(z.string()).optional(),
    expectedDistanceKm: z.number().min(0, 'Distance must be positive').optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    routeCode: z.string().optional(),
    pickupLocation: z.string().min(2).optional(),
    dropLocation: z.string().min(2).optional(),
    intermediateStops: z.array(z.string()).optional(),
    expectedDistanceKm: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const getRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryRouteSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  }),
});
