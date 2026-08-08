import { z } from 'zod';

/**
 * Changing an administrator's own password.
 *
 * There was no way to do this — no endpoint, no dashboard screen, and no admin
 * account management of any kind. The single administrator's password came from
 * the seed, which published it, and nothing in the product could rotate it. See
 * qa/final-delivery-audit/security/T-06-credentials.md.
 */
export const AdminChangePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'كلمة المرور الحالية مطلوبة' })
      .min(1, 'كلمة المرور الحالية مطلوبة'),
    newPassword: z
      .string({ required_error: 'كلمة المرور الجديدة مطلوبة' })
      // 12 rather than 8: this account holds every permission in the system, and
      // the endpoint is reachable from the public internet.
      .min(12, 'كلمة المرور الجديدة يجب ألا تقل عن 12 حرفاً'),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية',
    path: ['newPassword'],
  });

export type AdminChangePasswordDto = z.infer<typeof AdminChangePasswordSchema>;
