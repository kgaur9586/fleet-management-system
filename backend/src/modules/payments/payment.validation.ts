import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: 'Invalid ObjectId',
});

const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'other']);
const paymentStatusSchema = z.enum(['pending', 'received', 'cancelled']);

export const createPaymentSchema = z.object({
  body: z.object({
    invoiceId: objectIdSchema,
    firmId: objectIdSchema,
    amount: z.number().positive('Payment amount must be greater than zero'),
    paymentDate: z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Payment date is invalid'),
    paymentMethod: paymentMethodSchema,
    referenceNumber: z.string().trim().min(1).optional(),
    status: paymentStatusSchema.optional(),
    notes: z.string().trim().optional(),
  }),
});

export const listPaymentSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
    invoiceId: objectIdSchema.optional(),
    firmId: objectIdSchema.optional(),
    status: paymentStatusSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const paymentSummarySchema = z.object({
  query: z.object({
    firmId: objectIdSchema.optional(),
    month: z.string().regex(/^\d{1,2}$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
    year: z.string().regex(/^\d{4}$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
  }),
});
