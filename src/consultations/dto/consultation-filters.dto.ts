import { z } from 'zod';

export const ConsultationFiltersSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ConsultationFiltersDto = z.infer<typeof ConsultationFiltersSchema>;
