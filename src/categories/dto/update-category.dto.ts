import { z } from 'zod';

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب').optional(),
  icon: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  parentId: z.string().uuid('معرف التصنيف الأب غير صالح').optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
