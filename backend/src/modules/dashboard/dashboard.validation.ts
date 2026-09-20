import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{1,2}$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
    year: z.string().regex(/^\d{4}$/).optional().transform((value) => value === undefined ? undefined : Number(value)),
  }).refine((value) => (value.month === undefined) === (value.year === undefined), {
    message: 'Month and year must be provided together',
  }),
});
