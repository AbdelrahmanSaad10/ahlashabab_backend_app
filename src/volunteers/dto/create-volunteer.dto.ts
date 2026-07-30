import { z } from 'zod';

export const CreateVolunteerSchema = z.object({
  name: z
    .string({ required_error: 'الاسم مطلوب' })
    .min(1, 'الاسم مطلوب'),
  phone: z
    .string({ required_error: 'رقم الهاتف مطلوب' })
    .min(10, 'رقم الهاتف غير صالح'),
  age: z.number().int().min(1).max(150).optional(),
  governorateId: z.number().int().optional(),
  interests: z
    .array(z.string(), { required_error: 'الاهتمامات مطلوبة' })
    .min(1, 'يجب اختيار اهتمام واحد على الأقل'),
  availability: z.string().optional(),
});

export type CreateVolunteerDto = z.infer<typeof CreateVolunteerSchema>;
