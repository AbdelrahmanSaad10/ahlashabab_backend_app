import { z } from 'zod';

const ScheduleItemSchema = z.object({
  weekday: z
    .number({ required_error: 'اليوم مطلوب' })
    .int()
    .min(0, 'اليوم يجب أن يكون بين 0 و6')
    .max(6, 'اليوم يجب أن يكون بين 0 و6'),
  startTime: z
    .string({ required_error: 'وقت البداية مطلوب' })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صالحة (HH:mm)'),
  endTime: z
    .string({ required_error: 'وقت النهاية مطلوب' })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صالحة (HH:mm)'),
  slotMinutes: z
    .number({ required_error: 'مدة الموعد مطلوبة' })
    .int()
    .min(5, 'مدة الموعد يجب أن تكون 5 دقائق على الأقل')
    .max(480, 'مدة الموعد يجب أن تكون أقل من 8 ساعات'),
});

export const UpdateScheduleSchema = z.object({
  schedules: z.array(ScheduleItemSchema),
});

export type UpdateScheduleDto = z.infer<typeof UpdateScheduleSchema>;
