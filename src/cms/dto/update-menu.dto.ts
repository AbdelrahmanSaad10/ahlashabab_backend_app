import { z } from 'zod';

export const UpdateMenuSchema = z.object({
  menu: z.array(z.any()),
});

export type UpdateMenuDto = z.infer<typeof UpdateMenuSchema>;
