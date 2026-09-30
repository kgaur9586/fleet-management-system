import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const generateInvoiceSchema = z.object({
  body: z.object({
    firmId: objectIdSchema,
    vehicleId: objectIdSchema,
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000),
    notes: z.string().trim().optional(),
    bookNumber: z.string().trim().max(40).optional(),
  }),
});

export const reopenInvoiceSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().trim().min(5, 'A reason of at least 5 characters is required to reopen a bill'),
  }),
});

export const queryInvoiceSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    search: z.string().trim().optional(),
    firmId: objectIdSchema.optional(),
    vehicleId: objectIdSchema.optional(),
    status: z.enum(['draft', 'review', 'approved', 'finalized']).optional(),
    month: z.string().regex(/^\d{1,2}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    year: z.string().regex(/^\d{4}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
  }),
});

export const getInvoiceSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const invoiceTransitionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    notes: z.string().trim().optional(),
    note: z.string().trim().optional(),
  }).transform((value) => ({
    notes: value.notes ?? value.note,
  })),
});
