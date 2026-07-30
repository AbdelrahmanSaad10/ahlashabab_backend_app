import { z } from 'zod';

export const UpdateHomeSchema = z.object({
  sections: z.array(z.any()),
});

export type UpdateHomeDto = z.infer<typeof UpdateHomeSchema>;
