import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z
    .string({ required_error: 'اسم الدور مطلوب' })
    .min(1, 'اسم الدور مطلوب'),
  description: z.string().optional(),
  permissionsJson: z.record(
    z.object({
      read: z.boolean(),
      write: z.boolean(),
    }),
  ),
});

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;
