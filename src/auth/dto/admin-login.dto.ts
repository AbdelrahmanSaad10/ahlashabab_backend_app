import { z } from 'zod';

export const AdminLoginSchema = z.object({
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب' })
    .email('بريد إلكتروني غير صالح'),
  password: z
    .string({ required_error: 'كلمة المرور مطلوبة' })
    .min(1, 'كلمة المرور مطلوبة'),
});

export type AdminLoginDto = z.infer<typeof AdminLoginSchema>;
