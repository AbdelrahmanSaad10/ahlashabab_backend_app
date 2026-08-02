import { z } from 'zod';

/**
 * Body schema for `PUT /admin/cms` and `POST /admin/cms/import`.
 *
 * ACCEPTS BOTH SPELLINGS of the three fields the v6 alignment renamed on the
 * read side. `getPublicSnapshot()` emits `version`, `consultations` and `media`,
 * while this schema was written against the older `schemaVersion`,
 * `consultationTypes` and `mediaLibrary` — so a client that read the CMS, edited
 * it and posted it back could not succeed (issue #7). The old names keep working
 * so no existing integration breaks; the transform normalises to the internal
 * names the service uses.
 *
 * Arrays are left UNDEFINED when absent rather than defaulted to `[]`. That is
 * the important half: with `.default([])`, omitting `consultationTypes` silently
 * replaced every consultation type with an empty array, and the required
 * `schemaVersion` was the only thing standing between a client and that wipe.
 * Absent now means "leave what is stored alone" — see `replaceState`. A caller
 * that genuinely wants to clear a collection sends an explicit `[]`, which is
 * still honoured.
 */
export const ImportCmsSchema = z
  .object({
    schemaVersion: z.number().int().min(1).optional(),
    /** Read-side name for schemaVersion. */
    version: z.number().int().min(1).optional(),

    settings: z.record(z.string(), z.any()).optional(),
    menu: z.array(z.any()).optional(),
    home: z.array(z.any()).optional(),
    pages: z.array(z.any()).optional(),
    paymentMethods: z.array(z.any()).optional(),

    consultationTypes: z.array(z.any()).optional(),
    /** Read-side name for consultationTypes. */
    consultations: z.array(z.any()).optional(),

    mediaLibrary: z.array(z.any()).optional(),
    /** Read-side name for mediaLibrary. */
    media: z.array(z.any()).optional(),
  })
  .transform((v) => ({
    schemaVersion: v.schemaVersion ?? v.version,
    settings: v.settings,
    menu: v.menu,
    home: v.home,
    pages: v.pages,
    paymentMethods: v.paymentMethods,
    consultationTypes: v.consultationTypes ?? v.consultations,
    mediaLibrary: v.mediaLibrary ?? v.media,
  }))
  .refine((v) => typeof v.schemaVersion === 'number', {
    message: 'schemaVersion (أو version) مطلوب',
    path: ['schemaVersion'],
  });

export type ImportCmsDto = z.infer<typeof ImportCmsSchema>;
