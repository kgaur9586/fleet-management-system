import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const driverHistoryEventSchema = z.object({
  eventType: z.enum(['hired', 'suspended', 'terminated', 'rejoined', 'other']),
  date: z.string().datetime().optional(), // ISO string
  notes: z.string().optional(),
});

export const createDriverSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    mobile: z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid mobile number format'),
    employeeId: z.string().optional(),
    joiningDate: z.string().datetime().optional(),
    dailyWage: z.number().min(0, 'Daily wage must be a positive number'),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
    history: z.array(driverHistoryEventSchema).optional(),
  }),
});

export const updateDriverSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    mobile: z.string().regex(/^\+?[\d\s-]{10,15}$/).optional(),
    employeeId: z.string().optional(),
    joiningDate: z.string().datetime().optional(),
    dailyWage: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
    history: z.array(driverHistoryEventSchema).optional(), // Can replace history, or we handle appending in service
  }),
});

export const getDriverSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryDriverSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  }),
});
