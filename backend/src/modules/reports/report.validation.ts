import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' });
const monthField = z.string().regex(/^\d{1,2}$/).transform((value) => Number(value)).refine((value) => value >= 1 && value <= 12, { message: 'Month must be 1-12' });
const yearField = z.string().regex(/^\d{4}$/).transform((value) => Number(value));

export const monthlyReportSchema = z.object({
  query: z.object({
    month: monthField,
    year: yearField,
  }),
});

export const billRegisterSchema = z.object({
  query: z.object({
    month: monthField.optional(),
    year: yearField.optional(),
    firmId: objectIdSchema.optional(),
    status: z.enum(['draft', 'review', 'approved', 'finalized']).optional(),
  }),
});

export const firmReceivablesSchema = z.object({
  params: z.object({ firmId: objectIdSchema }),
});

export const maintenanceHistorySchema = z.object({
  query: z.object({
    vehicleId: objectIdSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

export const documentExpirySchema = z.object({
  query: z.object({
    vehicleId: objectIdSchema.optional(),
    documentType: z.enum(['rc', 'insurance', 'permit', 'fitness', 'pollution', 'other']).optional(),
  }),
});

export const driverWageSummarySchema = z.object({
  query: z.object({
    driverId: objectIdSchema.optional(),
    month: monthField.optional(),
    year: yearField.optional(),
  }),
});
