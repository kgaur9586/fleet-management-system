import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid ObjectId' });
const documentTypeSchema = z.enum(['rc', 'insurance', 'permit', 'fitness', 'pollution', 'other']);
const statusSchema = z.enum(['active', 'expiring_soon', 'expired']);

const dateSchema = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Date is invalid');

const metadataFields = {
  vehicleId: objectIdSchema,
  documentType: documentTypeSchema,
  documentNumber: z.string().trim().min(1).optional(),
  issueDate: dateSchema.optional(),
  expiryDate: dateSchema,
  fileReference: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
};

const withDateOrder = z.object(metadataFields).refine((value) => !value.issueDate || value.issueDate <= value.expiryDate, {
  message: 'Issue date must be on or before expiry date',
  path: ['expiryDate'],
});

export const createVehicleDocumentSchema = z.object({ body: withDateOrder });
export const uploadVehicleDocumentSchema = z.object({
  body: z.object({
    vehicleId: objectIdSchema,
    documentType: documentTypeSchema,
    documentNumber: z.string().trim().min(1).optional(),
    issueDate: dateSchema.optional(),
    expiryDate: dateSchema,
    notes: z.string().trim().optional(),
  }),
});
export const listVehicleDocumentSchema = z.object({
  query: z.object({
    vehicleId: objectIdSchema.optional(),
    documentType: documentTypeSchema.optional(),
    status: statusSchema.optional(),
    page: z.string().regex(/^\d+$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
    limit: z.string().regex(/^\d+$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
  }),
});
export const getVehicleDocumentSchema = z.object({ params: z.object({ id: objectIdSchema }) });
