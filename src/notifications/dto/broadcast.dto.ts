import { z } from 'zod';

export const BroadcastSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  segment: z.enum(['all', 'donors', 'governorate']),
  governorateId: z.number().int().positive().optional(),
});

export type BroadcastDto = z.infer<typeof BroadcastSchema>;
