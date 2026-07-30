import { z } from 'zod';
import { CreateRoleSchema } from './create-role.dto';

export const UpdateRoleSchema = CreateRoleSchema.partial();

export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
