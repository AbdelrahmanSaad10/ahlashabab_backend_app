import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: 'اسم التصنيف مطلوب' })
    .min(1, 'اسم التصنيف مطلوب'),
  icon: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().uuid('معرف التصنيف الأب غير صالح').optional().nullable(),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
