import { z } from 'zod';

export const CreateConsultationSchema = z.object({
  type: z
    .string({ required_error: 'نوع الاستشارة مطلوب' })
    .min(1, 'نوع الاستشارة مطلوب'),
  name: z
    .string({ required_error: 'الاسم مطلوب' })
    .min(1, 'الاسم مطلوب'),
  phone: z
    .string({ required_error: 'رقم الهاتف مطلوب' })
    .min(10, 'رقم الهاتف غير صالح'),
  whatsapp: z.string().optional(),
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب' })
    .email('البريد الإلكتروني غير صالح'),
  age: z.number().int().min(1).max(150).optional(),
  governorate: z.string().optional(),
  preferredChannel: z.string().optional(),
  preferredTime: z.string().optional(),
  summary: z.string().optional(),
  extraFields: z.record(z.unknown()).optional(),
});

export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>;
