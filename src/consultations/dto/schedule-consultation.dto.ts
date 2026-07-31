import { z } from 'zod';

export const ScheduleConsultationSchema = z.object({
  providerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/),
});

export type ScheduleConsultationDto = z.infer<typeof ScheduleConsultationSchema>;
