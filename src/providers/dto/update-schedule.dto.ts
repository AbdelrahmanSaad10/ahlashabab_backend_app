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

/**
 * Each field was validated, but never the pair — so `17:00 → 09:00` stored fine
 * and `generateTimeSlots` returned nothing, leaving a provider that looks
 * scheduled and can never be booked. The range must fit at least one slot.
 */
const ScheduleItemWithRange = ScheduleItemSchema.superRefine((v, ctx) => {
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const span = mins(v.endTime) - mins(v.startTime);
  if (span <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'وقت النهاية يجب أن يكون بعد وقت البداية',
    });
    return;
  }
  if (span < v.slotMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['slotMinutes'],
      message: 'المدة لا تكفي لموعد واحد',
    });
  }
});

export const UpdateScheduleSchema = z.object({
  schedules: z.array(ScheduleItemWithRange),
});

export type UpdateScheduleDto = z.infer<typeof UpdateScheduleSchema>;
