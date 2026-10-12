import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' });

export const generateSalarySchema = z.object({
  body: z.object({
    driverId: objectIdSchema,
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000),
  }),
});

export const listSalarySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    driverId: objectIdSchema.optional(),
    month: z.string().regex(/^\d{1,2}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    year: z.string().regex(/^\d{4}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    paymentStatus: z.enum(['pending', 'paid']).optional(),
  }),
});

export const getSalarySchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const applyDeductionSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    amount: z.number().min(0, 'Deduction amount cannot be negative'),
  }),
});

export const setOtherDeductionsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    amount: z.number().min(0, 'Deduction amount cannot be negative'),
  }),
});

export const markPaidSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    paidOn: z.coerce.date().optional(),
    paymentMode: z.enum(['cash', 'bank_transfer', 'cheque', 'other']).optional(),
    paymentReference: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});
