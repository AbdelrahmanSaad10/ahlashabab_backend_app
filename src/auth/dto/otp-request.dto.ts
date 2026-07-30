import { z } from 'zod';

export const OtpRequestSchema = z.object({
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب' })
    .email('بريد إلكتروني غير صالح'),
});

export type OtpRequestDto = z.infer<typeof OtpRequestSchema>;
