import { z } from 'zod';

export const ReportFiltersSchema = z.object({
  groupBy: z
    .enum(['category', 'provider', 'governorate', 'status'])
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).optional(),
});

export type ReportFiltersDto = z.infer<typeof ReportFiltersSchema>;
