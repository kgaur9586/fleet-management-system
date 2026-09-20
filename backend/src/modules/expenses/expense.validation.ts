import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const commonExpenseFields = {
  category: z.enum(['fuel', 'toll', 'maintenance', 'service', 'insurance', 'driver_wages', 'driver_advance', 'loading_unloading', 'other']),
  date: z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), { message: 'Expense date is required' }),
  amount: z.number().min(0, 'Amount must be 0 or greater'),
  vehicleId: objectIdSchema.optional(),
  firmId: objectIdSchema.optional(),
  tripId: objectIdSchema.optional(),
  vendor: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1, 'Description is required'),
  attachmentUrl: z.string().trim().url('Attachment URL is invalid').optional().or(z.literal('')),
  notes: z.string().trim().optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'cancelled']).optional(),
  paymentDate: z.coerce.date().optional(),
  adjustments: z.number().min(0).optional(),
  grossWage: z.number().min(0).optional(),
  finalPayment: z.number().min(0).optional(),
  applicableDays: z.number().int().min(0).optional(),
};

const fuelDetailsSchema = z.object({
  litresPurchased: z.number().min(0).optional(),
  ratePerLitre: z.number().min(0).optional(),
  pumpName: z.string().trim().min(1).optional(),
});

const tollDetailsSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).optional(),
  source: z.string().trim().optional(),
});

const maintenanceDetailsSchema = z.object({
  maintenanceType: z.string().trim().min(1).optional(),
  workshopName: z.string().trim().optional(),
  odometer: z.number().min(0).optional(),
});

const serviceDetailsSchema = z.object({
  serviceType: z.string().trim().min(1).optional(),
  workshopName: z.string().trim().optional(),
  odometer: z.number().min(0).optional(),
});

const insuranceDetailsSchema = z.object({
  insurerName: z.string().trim().min(1).optional(),
  policyNumber: z.string().trim().optional(),
  coverageType: z.string().trim().optional(),
});

const driverWageDetailsSchema = z.object({
  driverId: objectIdSchema.optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).optional(),
  daysWorked: z.number().int().min(0).optional(),
  wageRate: z.number().min(0).optional(),
  grossWage: z.number().min(0).optional(),
  adjustments: z.number().min(0).optional(),
  finalPayment: z.number().min(0).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'cancelled']).optional(),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

const driverAdvanceDetailsSchema = z.object({
  driverId: objectIdSchema.optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).optional(),
  advanceAmount: z.number().min(0).optional(),
  recoveryMode: z.enum(['salary_deduction', 'future_trip_settlement', 'cash_adjustment', 'other']).optional(),
  adjustedAgainstWage: z.boolean().optional(),
  linkedExpenseId: objectIdSchema.optional(),
  notes: z.string().trim().optional(),
});

const loadingUnloadingDetailsSchema = z.object({
  contractorName: z.string().trim().min(1).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).optional(),
  chargeType: z.string().trim().optional(),
  reference: z.string().trim().optional(),
});

const expensePayloadSchema = z.object({
  ...commonExpenseFields,
  fuelDetails: fuelDetailsSchema.optional(),
  tollDetails: tollDetailsSchema.optional(),
  maintenanceDetails: maintenanceDetailsSchema.optional(),
  serviceDetails: serviceDetailsSchema.optional(),
  insuranceDetails: insuranceDetailsSchema.optional(),
  driverWageDetails: driverWageDetailsSchema.optional(),
  driverAdvanceDetails: driverAdvanceDetailsSchema.optional(),
  loadingUnloadingDetails: loadingUnloadingDetailsSchema.optional(),
});

export const createExpenseSchema = z.object({
  body: expensePayloadSchema,
});

export const updateExpenseSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: expensePayloadSchema.partial(),
});

export const getExpenseSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryExpenseSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    category: z.enum(['fuel', 'toll', 'maintenance', 'service', 'insurance', 'driver_wages', 'driver_advance', 'loading_unloading', 'other']).optional(),
    vehicleId: objectIdSchema.optional(),
    firmId: objectIdSchema.optional(),
    tripId: objectIdSchema.optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const summaryExpenseSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{1,2}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
    year: z.string().regex(/^\d{4}$/).optional().transform((value) => (value === undefined ? undefined : Number(value))),
  }),
});
