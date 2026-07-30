import { z } from 'zod';

export const CreateFavoriteSchema = z.object({
  entityType: z.enum(['project', 'case', 'service'], {
    required_error: 'نوع العنصر مطلوب',
  }),
  entityId: z.string({ required_error: 'معرف العنصر مطلوب' }).min(1, 'معرف العنصر مطلوب'),
});

export type CreateFavoriteDto = z.infer<typeof CreateFavoriteSchema>;
