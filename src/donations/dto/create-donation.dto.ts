import { z } from 'zod';

export const CreateDonationSchema = z.object({
  donorName: z.string().min(2).max(100),
  /** Optional links — what the donation is FOR. `raisedAmount` derives from these. */
  caseId: z.string().uuid('معرّف الحالة غير صالح').optional(),
  projectId: z.string().uuid('معرّف المشروع غير صالح').optional(),

  cause: z.string().min(1),
  amount: z.number().int().positive(),
  /**
   * Only the client-approved methods are accepted for a NEW donation. There is
   * no online gateway, so card payment is rejected server-side — the legacy
   * values stay in `DonationMethod` for historical rows and filters only.
   */
  method: z.enum([
    'تحويل بنكي',
    'فوري',
    'فودافون كاش',
  ]),
  recurring: z.boolean().optional().default(false),
});

export type CreateDonationDto = z.infer<typeof CreateDonationSchema>;
