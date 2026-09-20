import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: 'Invalid ObjectId',
});

const decimalSchema = z.number().finite().min(0);

const hiringMultiplierRuleSchema = z.object({
  minKm: decimalSchema,
  maxKm: decimalSchema.optional(),
  multiplier: decimalSchema,
});

const capacityRateSchema = z.object({
  capacity: z.number().finite().positive(),
  contractualAverageKmPerLitre: z.number().finite().positive(),
  baseHiringRatePerRound: decimalSchema,
  hiringMultiplierRules: z.array(hiringMultiplierRuleSchema).optional(),
});

const kmThresholdSchema = z.object({
  upToKm: decimalSchema.optional(),
  rounds: decimalSchema,
});

const otherChargeSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  amount: decimalSchema,
  basis: z.enum(['flat', 'perTrip', 'perKm', 'perRound']),
  isActive: z.boolean().optional(),
});

export const billingRulesSchema = z
  .object({
    capacityRates: z.array(capacityRateSchema).min(1, 'At least one capacity rate is required'),
    fuelRatePerLitre: decimalSchema,
    kmThresholds: z.array(kmThresholdSchema).min(1, 'At least one KM threshold is required'),
    tollTreatment: z.enum(['excluded', 'actual', 'fixed']),
    otherBillableCharges: z.array(otherChargeSchema).optional(),
  })
  .superRefine((rules, context) => {
    const capacities = rules.capacityRates.map((rate) => rate.capacity);
    if (new Set(capacities).size !== capacities.length) {
      context.addIssue({ code: 'custom', path: ['capacityRates'], message: 'Capacity entries must be unique' });
    }

    const codes = (rules.otherBillableCharges ?? []).map((charge) => charge.code.toLowerCase());
    if (new Set(codes).size !== codes.length) {
      context.addIssue({ code: 'custom', path: ['otherBillableCharges'], message: 'Charge codes must be unique' });
    }

    let previousThreshold = -1;
    rules.kmThresholds.forEach((threshold, index) => {
      if (threshold.upToKm !== undefined && threshold.upToKm <= previousThreshold) {
        context.addIssue({ code: 'custom', path: ['kmThresholds', index, 'upToKm'], message: 'KM thresholds must be ascending' });
      }
      if (threshold.upToKm !== undefined) previousThreshold = threshold.upToKm;
      if (threshold.upToKm === undefined && index !== rules.kmThresholds.length - 1) {
        context.addIssue({ code: 'custom', path: ['kmThresholds', index], message: 'An unlimited KM threshold must be last' });
      }
    });

    rules.capacityRates.forEach((rate, rateIndex) => {
      let previousMaximum = -1;
      (rate.hiringMultiplierRules ?? []).forEach((multiplier, multiplierIndex) => {
        if (multiplier.maxKm !== undefined && multiplier.maxKm <= multiplier.minKm) {
          context.addIssue({ code: 'custom', path: ['capacityRates', rateIndex, 'hiringMultiplierRules', multiplierIndex, 'maxKm'], message: 'Maximum KM must exceed minimum KM' });
        }
        if (multiplier.minKm < previousMaximum) {
          context.addIssue({ code: 'custom', path: ['capacityRates', rateIndex, 'hiringMultiplierRules', multiplierIndex], message: 'Hiring multiplier ranges must be ordered and non-overlapping' });
        }
        previousMaximum = multiplier.maxKm ?? Number.POSITIVE_INFINITY;
      });
    });
  });

const versionFields = z.object({
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  billingRules: billingRulesSchema,
  notes: z.string().trim().optional(),
});

export const createContractSchema = z.object({
  body: z.object({
    firmId: objectIdSchema,
    companyId: objectIdSchema.optional(),
    name: z.string().trim().min(2),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateContractSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    companyId: objectIdSchema.optional().nullable(),
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getContractSchema = z.object({ params: z.object({ id: objectIdSchema }) });

export const queryContractSchema = z.object({
  query: z.object({
    page: z.string().regex(/^[1-9]\d*$/).transform(Number).optional(),
    limit: z.string().regex(/^[1-9]\d*$/).transform(Number).refine((value) => value <= 100).optional(),
    search: z.string().trim().optional(),
    firmId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  }),
});

export const createVersionSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: versionFields,
});

export const versionIdSchema = z.object({
  params: z.object({ id: objectIdSchema, versionId: objectIdSchema }),
});

export const queryVersionSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  query: z.object({
    date: z.coerce.date().optional(),
  }),
});