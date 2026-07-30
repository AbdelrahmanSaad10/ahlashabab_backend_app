import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'الاسم قصير جدًا').max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  governorateId: z.number().int().optional(),
  bio: z.string().max(500).optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
