import { z } from 'zod';

export const PortfolioFiltersSchema = z.object({
  type: z.string().optional(),
  published: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  governorate: z.string().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PortfolioFiltersDto = z.infer<typeof PortfolioFiltersSchema>;
