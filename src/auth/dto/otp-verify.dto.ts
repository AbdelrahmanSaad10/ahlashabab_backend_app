import { z } from 'zod';

export const OtpVerifySchema = z.object({
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب' })
    .email('بريد إلكتروني غير صالح'),
  code: z
    .string({ required_error: 'رمز التحقق مطلوب' })
    .length(6, 'رمز التحقق يجب أن يكون 6 أرقام'),
});

export type OtpVerifyDto = z.infer<typeof OtpVerifySchema>;
