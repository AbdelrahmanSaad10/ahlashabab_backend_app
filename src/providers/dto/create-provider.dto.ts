import { z } from 'zod';

export const CreateProviderSchema = z.object({
  name: z
    .string({ required_error: 'اسم مقدم الخدمة مطلوب' })
    .min(1, 'اسم مقدم الخدمة مطلوب'),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  avatarUrl: z.string().url('رابط الصورة غير صالح').optional().nullable(),
  active: z.boolean().optional().default(true),
});

export type CreateProviderDto = z.infer<typeof CreateProviderSchema>;
