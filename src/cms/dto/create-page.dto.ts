import { z } from 'zod';

export const CreatePageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  body: z.string().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  sortOrder: z.number().int().default(0),
});

export type CreatePageDto = z.infer<typeof CreatePageSchema>;
