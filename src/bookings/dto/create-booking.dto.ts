import { z } from 'zod';

export const CreateBookingSchema = z.object({
  serviceId: z.string().uuid(),
  applicantName: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  age: z.number().int().min(1).max(150).optional(),
  gender: z.enum(['ذكر', 'أنثى']).optional(),
  governorateId: z.number().int().optional(),
  city: z.string().max(100).optional(),
  nationalId: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  notes: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/),
  extraFields: z.record(z.unknown()).optional(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
