import { z } from 'zod';

export const CreateContactSchema = z.object({
  name: z
    .string({ required_error: 'الاسم مطلوب' })
    .min(1, 'الاسم مطلوب'),
  phone: z
    .string({ required_error: 'رقم الهاتف مطلوب' })
    .min(10, 'رقم الهاتف غير صالح'),
  message: z
    .string({ required_error: 'الرسالة مطلوبة' })
    .min(1, 'الرسالة مطلوبة'),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
