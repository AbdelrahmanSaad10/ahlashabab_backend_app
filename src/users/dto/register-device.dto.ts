import { z } from 'zod';

export const RegisterDeviceSchema = z.object({
  token: z
    .string({ required_error: 'رمز الجهاز مطلوب' })
    .min(1, 'رمز الجهاز مطلوب'),
  platform: z.enum(['ios', 'android', 'web'], {
    required_error: 'المنصة مطلوبة',
  }),
});

export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;
