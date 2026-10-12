import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' });

export const createDriverAdvanceSchema = z.object({
  body: z.object({
    driverId: objectIdSchema,
    amount: z.number().positive('Advance amount must be greater than zero'),
    date: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const listDriverAdvanceSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    driverId: objectIdSchema.optional(),
    includeSettled: z.enum(['true', 'false']).optional().transform((value) => (value === undefined ? undefined : value === 'true')),
  }),
});

export const getDriverAdvanceSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
