import { z } from 'zod';

const FormFieldSchema = z.object({
  key: z.string().min(1, 'مفتاح الحقل مطلوب'),
  label: z.string().min(1, 'عنوان الحقل مطلوب'),
  type: z.string().min(1, 'نوع الحقل مطلوب'),
  required: z.boolean().optional().default(false),
  hidden: z.boolean().optional().default(false),
  optionsJson: z.any().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const CreateServiceSchema = z.object({
  name: z
    .string({ required_error: 'اسم الخدمة مطلوب' })
    .min(1, 'اسم الخدمة مطلوب'),
  description: z.string().optional(),
  categoryId: z
    .string({ required_error: 'التصنيف مطلوب' })
    .uuid('معرف التصنيف غير صالح'),
  providerId: z
    .string({ required_error: 'مقدم الخدمة مطلوب' })
    .uuid('معرف مقدم الخدمة غير صالح'),
  free: z.boolean().optional().default(true),
  requireNationalId: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  formFields: z.array(FormFieldSchema).optional(),
});

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
