import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
});

const contactDetailsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  mobile: z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid mobile number format').optional().or(z.literal('')),
});

const bankDetailsSchema = z.object({
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  bankName: z.string().optional(),
  branchName: z.string().optional(),
});

export const createFirmSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Firm name must be at least 2 characters'),
    companyId: objectIdSchema.optional(),
    billingName: z.string().optional(),
    billPrefix: z.string().min(2).max(10).regex(/^[A-Za-z0-9]+$/, 'Bill prefix must be alphanumeric').optional(),
    address: addressSchema.optional(),
    contactDetails: contactDetailsSchema.optional(),
    bankDetails: bankDetailsSchema.optional(),
    gstNumber: z.string().optional(),
    isActive: z.boolean().optional(),
    billingConfiguration: z.record(z.string(), z.any()).optional(),
    notes: z.string().optional(),
  }),
});

export const updateFirmSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    companyId: objectIdSchema.nullable().optional(),
    billingName: z.string().optional(),
    billPrefix: z.string().min(2).max(10).regex(/^[A-Za-z0-9]+$/, 'Bill prefix must be alphanumeric').optional(),
    address: addressSchema.optional(),
    contactDetails: contactDetailsSchema.optional(),
    bankDetails: bankDetailsSchema.optional(),
    gstNumber: z.string().optional(),
    isActive: z.boolean().optional(),
    billingConfiguration: z.record(z.string(), z.any()).optional(),
    notes: z.string().optional(),
  }),
});

export const getFirmSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const queryFirmSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  }),
});
