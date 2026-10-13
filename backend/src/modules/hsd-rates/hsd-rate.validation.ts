import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' });

export const createHsdRateSchema = z.object({
  body: z.object({
    ratePerLitre: z.number().positive('Rate per litre must be greater than zero'),
    effectiveFrom: z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Effective date is invalid'),
    notes: z.string().trim().optional(),
  }),
});

export const listHsdRateSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
  }),
});

export const getHsdRateSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const effectiveHsdRateSchema = z.object({
  query: z.object({
    date: z.string().optional(),
  }),
});
