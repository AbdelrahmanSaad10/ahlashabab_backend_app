import { z } from 'zod';

export const UpdatePreferencesSchema = z.object({
  donations: z.boolean().optional(),
  cases: z.boolean().optional(),
  projects: z.boolean().optional(),
  bookings: z.boolean().optional(),
  news: z.boolean().optional(),
  system: z.boolean().optional(),
});

export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;
