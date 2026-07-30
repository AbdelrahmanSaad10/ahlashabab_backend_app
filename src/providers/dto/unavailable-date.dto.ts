import { z } from 'zod';

export const UnavailableDateSchema = z.object({
  date: z
    .string({ required_error: 'التاريخ مطلوب' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صالحة (YYYY-MM-DD)'),
});

export type UnavailableDateDto = z.infer<typeof UnavailableDateSchema>;
