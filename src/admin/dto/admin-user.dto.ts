import { z } from 'zod';

/**
 * Administrator accounts.
 *
 * There was no way to create, list, disable or delete one: `AdminUser` rows came
 * from the seed or from psql. The foundation had exactly one administrator, a
 * second could not be made through the product, and someone who left could not
 * be locked out except by hand on the database.
 *
 * `passwordHash` is never accepted or returned anywhere in these shapes — the
 * plaintext goes in, argon2 runs in the service, and nothing reads it back.
 */

/** Matches POST /admin/auth/change-password: this account can reach everything. */
const password = z
  .string({ required_error: 'كلمة المرور مطلوبة' })
  .min(12, 'كلمة المرور يجب ألا تقل عن 12 حرفاً');

export const CreateAdminUserSchema = z.object({
  name: z.string({ required_error: 'الاسم مطلوب' }).min(1, 'الاسم مطلوب'),
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب' })
    .email('بريد إلكتروني غير صالح'),
  password,
  roleId: z.string({ required_error: 'الدور مطلوب' }).uuid('معرّف الدور غير صالح'),
  /** Binds the account to a service provider, which is what `/me/provider` reads. */
  providerId: z.string().uuid('معرّف مقدم الخدمة غير صالح').nullish(),
});

export const UpdateAdminUserSchema = z
  .object({
    name: z.string().min(1, 'الاسم مطلوب'),
    roleId: z.string().uuid('معرّف الدور غير صالح'),
    active: z.boolean(),
    providerId: z.string().uuid('معرّف مقدم الخدمة غير صالح').nullable(),
  })
  .partial()
  // The email is the login identity and the key the seed upserts on; changing it
  // is an account migration, not an edit. Create a new account instead.
  .strict();

export const ResetAdminPasswordSchema = z.object({
  newPassword: password,
});

export type CreateAdminUserDto = z.infer<typeof CreateAdminUserSchema>;
export type UpdateAdminUserDto = z.infer<typeof UpdateAdminUserSchema>;
export type ResetAdminPasswordDto = z.infer<typeof ResetAdminPasswordSchema>;
