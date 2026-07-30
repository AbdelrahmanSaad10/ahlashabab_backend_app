import { z } from 'zod';

export const CreateArticleSchema = z.object({
  category: z.enum(['خبر', 'نشاط', 'مقال', 'قافلة'], {
    required_error: 'تصنيف المقال مطلوب',
  }),
  title: z
    .string({ required_error: 'عنوان المقال مطلوب' })
    .min(1, 'عنوان المقال مطلوب'),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)'),
  location: z.string().optional(),
  readMinutes: z.number().int().min(1).optional(),
  coverUrl: z.string().url('رابط الصورة غير صالح').optional(),
  published: z.boolean().optional().default(false),
});

export type CreateArticleDto = z.infer<typeof CreateArticleSchema>;
