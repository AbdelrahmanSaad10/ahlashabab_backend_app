import { z } from 'zod';

export const CreateDonationSchema = z.object({
  donorName: z.string().min(2).max(100),
  cause: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum([
    'بطاقة بنكية',
    'فوري',
    'إنستاباي',
    'فودافون كاش',
    'تحويل بنكي',
  ]),
  recurring: z.boolean().optional().default(false),
});

export type CreateDonationDto = z.infer<typeof CreateDonationSchema>;
