import { z } from 'zod';

export const UpdateArticleSchema = z.object({
  category: z.enum(['خبر', 'نشاط', 'مقال', 'قافلة']).optional(),
  title: z.string().min(1, 'عنوان المقال مطلوب').optional(),
  excerpt: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)').optional(),
  location: z.string().optional().nullable(),
  readMinutes: z.number().int().min(1).optional().nullable(),
  coverUrl: z.string().url('رابط الصورة غير صالح').optional().nullable(),
  published: z.boolean().optional(),
});

export type UpdateArticleDto = z.infer<typeof UpdateArticleSchema>;
