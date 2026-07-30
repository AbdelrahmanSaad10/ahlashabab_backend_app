import { z } from 'zod';

export const CreateCaseSchema = z.object({
  code: z
    .string({ required_error: 'كود الحالة مطلوب' })
    .min(1, 'كود الحالة مطلوب'),
  title: z
    .string({ required_error: 'عنوان الحالة مطلوب' })
    .min(1, 'عنوان الحالة مطلوب'),
  location: z.string().optional(),
  summary: z.string().optional(),
  need: z.string().optional(),
  tag: z.string().optional(),
  verified: z.boolean().optional().default(false),
  targetAmount: z.number().int().min(0).optional(),
  raisedAmount: z.number().int().min(0).optional().default(0),
  supporters: z.number().int().min(0).optional().default(0),
  coverUrl: z.string().url().optional(),
  sponsorable: z.boolean().optional().default(false),
  monthlyAmount: z.number().int().min(0).optional(),
  sponsorshipDuration: z.string().optional(),
  sponsorshipStatus: z.string().optional(),
  published: z.boolean().optional().default(false),
});

export type CreateCaseDto = z.infer<typeof CreateCaseSchema>;
