import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: 'Invalid ObjectId',
});

const dateSchema = z.coerce.date();
const kilometerSchema = z.number().finite().min(0, 'Kilometers cannot be negative');

const tripFields = z.object({
  tripDate: dateSchema,
  vehicleId: objectIdSchema,
  driverId: objectIdSchema,
  firmId: objectIdSchema,
  contractId: objectIdSchema,
  routeId: objectIdSchema.optional().nullable(),
  pickupLocation: z.string().trim().min(2, 'Pickup location is required'),
  dropLocation: z.string().trim().min(2, 'Drop location is required'),
  startKm: kilometerSchema.optional(),
  endKm: kilometerSchema.optional(),
  totalKm: z.number().finite().positive('Total kilometers must be greater than zero'),
  operationalStatus: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  toll: z.object({
    amount: z.number().finite().min(0, 'Toll amount cannot be negative'),
    reference: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }).optional(),
  operationalInfo: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().optional(),
});

const kilometerConsistency = (data: { startKm?: number; endKm?: number; totalKm?: number }, context: z.RefinementCtx) => {
  if (data.startKm !== undefined && data.endKm !== undefined && data.totalKm !== undefined) {
    if (data.endKm < data.startKm) {
      context.addIssue({ code: 'custom', path: ['endKm'], message: 'End kilometers cannot be less than start kilometers' });
    } else if (data.totalKm !== data.endKm - data.startKm) {
      context.addIssue({ code: 'custom', path: ['totalKm'], message: 'Total kilometers must equal end kilometers minus start kilometers' });
    }
  }
};

export const createTripSchema = z.object({ body: tripFields }).superRefine((data, context) => kilometerConsistency(data.body, context));

export const updateTripSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: tripFields.partial().superRefine(kilometerConsistency),
});

export const getTripSchema = z.object({ params: z.object({ id: objectIdSchema }) });

export const queryTripSchema = z.object({
  query: z.object({
    page: z.string().regex(/^[1-9]\d*$/, 'Page must be a positive integer').transform(Number).optional(),
    limit: z.string().regex(/^[1-9]\d*$/, 'Limit must be a positive integer').transform(Number).refine((value) => value <= 100, 'Limit cannot exceed 100').optional(),
    search: z.string().trim().optional(),
    fromDate: dateSchema.optional(),
    toDate: dateSchema.optional(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format').optional(),
    vehicleId: objectIdSchema.optional(),
    driverId: objectIdSchema.optional(),
    firmId: objectIdSchema.optional(),
    operationalStatus: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  }).superRefine((query, context) => {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      context.addIssue({ code: 'custom', path: ['toDate'], message: 'toDate cannot be before fromDate' });
    }
  }),
});