import { z } from 'zod';
import { ConsultationStatus } from '../../common/constants/statuses';

/**
 * Changing a consultation request's status.
 *
 * The route took `@Body('status') status: string` with no validation and wrote it
 * straight to the column, so `PATCH :id/status {"status":"anything"}` stored
 * "anything" — and every list, filter and badge downstream then had a value
 * nobody had defined.
 *
 * «تم تحديد موعد» is deliberately **not** accepted here. Scheduling means a
 * provider, a date and a time slot, and setting the status alone records that an
 * appointment was arranged while storing nothing about it. Use
 * `PATCH :id/schedule`, which takes all three.
 */
const SCHEDULABLE_ELSEWHERE = ConsultationStatus.SCHEDULED;

export const UpdateConsultationStatusSchema = z.object({
  status: z
    .enum(
      [
        ConsultationStatus.NEW,
        ConsultationStatus.UNDER_REVIEW,
        ConsultationStatus.SCHEDULED,
        ConsultationStatus.COMPLETED,
        ConsultationStatus.CANCELLED,
      ],
      { required_error: 'الحالة مطلوبة', invalid_type_error: 'حالة غير معروفة' },
    )
    .refine((s) => s !== SCHEDULABLE_ELSEWHERE, {
      message:
        'لتحديد موعد استخدم PATCH /admin/consultations/:id/schedule مع مقدم الخدمة والتاريخ والوقت',
    }),
});

export type UpdateConsultationStatusDto = z.infer<typeof UpdateConsultationStatusSchema>;
