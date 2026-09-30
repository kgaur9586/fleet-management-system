import { z } from 'zod';
import mongoose from 'mongoose';

// Custom validation for MongoDB ObjectId
const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const createVehicleSchema = z.object({
  body: z.object({
    registrationNumber: z
      .string()
      .min(3, 'Registration number must be at least 3 characters')
      .max(20, 'Registration number is too long')
      .regex(/^[A-Z0-9\-\s]+$/i, 'Registration number contains invalid characters'),
    vehicleType: z.string().min(1, 'Vehicle type is required'),
    capacity: z.number().min(0.1, 'Capacity must be greater than 0'),
    make: z.string().optional(),
    vehicleModel: z.string().optional(),
    firmId: objectIdSchema.optional(),
    vehicleNumberPerFirm: z.number().int().min(1).optional(),
    status: z.enum(['available', 'on_trip', 'maintenance']).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    registrationNumber: z
      .string()
      .min(3, 'Registration number must be at least 3 characters')
      .max(20, 'Registration number is too long')
      .regex(/^[A-Z0-9\-\s]+$/i, 'Registration number contains invalid characters')
      .optional(),
    vehicleType: z.string().min(1).optional(),
    capacity: z.number().min(0.1).optional(),
    make: z.string().optional(),
    vehicleModel: z.string().optional(),
    isActive: z.boolean().optional(),
    firmId: objectIdSchema.nullable().optional(), // Allow removing firm association
    vehicleNumberPerFirm: z.number().int().min(1).optional(),
    status: z.enum(['available', 'on_trip', 'maintenance']).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const getVehicleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryVehicleSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    search: z.string().optional(),
    status: z.enum(['available', 'on_trip', 'maintenance']).optional(),
    isActive: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
    vehicleType: z.string().optional(),
    firmId: objectIdSchema.optional(),
  }),
});
