import { z } from 'zod';

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'رمز التحديث مطلوب' })
    .min(1, 'رمز التحديث مطلوب'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
