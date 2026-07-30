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

export const UpdateServiceSchema = z.object({
  name: z.string().min(1, 'اسم الخدمة مطلوب').optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid('معرف التصنيف غير صالح').optional(),
  providerId: z.string().uuid('معرف مقدم الخدمة غير صالح').optional(),
  free: z.boolean().optional(),
  requireNationalId: z.boolean().optional(),
  active: z.boolean().optional(),
  formFields: z.array(FormFieldSchema).optional(),
});

export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;
