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

const companyFields = {
  legalName: z.string().optional(),
  address: addressSchema.optional(),
  contactDetails: contactDetailsSchema.optional(),
  gstNumber: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
};

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters'),
    ...companyFields,
  }),
});

export const updateCompanySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().min(2).optional(),
    ...companyFields,
  }),
});

export const getCompanySchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const queryCompanySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional().transform((val) => (val === undefined ? undefined : val === 'true')),
  }),
});
