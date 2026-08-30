import { z } from 'zod';

/**
 * Deleting an account is irreversible, so it takes an explicit confirmation
 * rather than being one stray `DELETE /me` away. The app puts a confirmation
 * dialog in front of it; this is the second lock, for everything that is not
 * the app.
 */
export const DeleteAccountSchema = z.object({
  confirm: z.literal('DELETE', {
    errorMap: () => ({ message: 'للتأكيد، أرسل الحقل confirm بالقيمة DELETE' }),
  }),
});

export type DeleteAccountDto = z.infer<typeof DeleteAccountSchema>;
