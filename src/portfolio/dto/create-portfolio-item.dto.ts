import { z } from 'zod';

export const CreatePortfolioItemSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  published: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export type CreatePortfolioItemDto = z.infer<typeof CreatePortfolioItemSchema>;
