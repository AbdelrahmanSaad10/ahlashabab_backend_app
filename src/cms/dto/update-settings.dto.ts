import { z } from 'zod';

export const UpdateSettingsSchema = z.record(z.string(), z.any());

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
