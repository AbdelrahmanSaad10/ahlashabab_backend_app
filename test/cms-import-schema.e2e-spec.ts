import 'reflect-metadata';
import { ImportCmsSchema } from '../src/cms/dto/import-cms.dto';

/**
 * Round-trip coverage for `PUT /admin/cms` (issue #7).
 *
 * `getPublicSnapshot()` renames three fields on the way out — `schemaVersion` →
 * `version`, `consultationTypes` → `consultations`, `mediaLibrary` → `media` —
 * but `ImportCmsSchema` still required the old spellings. A client that read the
 * CMS, edited it and posted it straight back could not succeed.
 *
 * The read/write asymmetry is not the dangerous part on its own. `schemaVersion`
 * was required, so a naive round trip failed loudly with a 400. But
 * `consultationTypes` was `.optional().default([])`, so the moment a client
 * fixed that 400 — the obvious response — the payload still carried
 * `consultations`, the default applied, and every consultation type was replaced
 * with an empty array. Silently. The required field was the only thing
 * preventing the wipe.
 *
 * These assert the exact payload a client gets from `GET /cms` is now accepted,
 * and that omission can never again be read as "delete everything".
 */

/** What `GET /cms` actually returns, trimmed to the keys that matter here. */
const snapshotFromApi = () => ({
  version: 10,
  settings: { appName: 'خواطر أحلى شباب', hotline: '19XXX' },
  menu: [{ id: 'g1' }],
  home: [{ id: 'h1' }],
  pages: [{ id: 'p1' }],
  paymentMethods: [{ id: 'بطاقة بنكية' }],
  consultations: [{ key: 'نفسية' }, { key: 'دينية' }, { key: 'طبية' }],
  media: [{ id: 'm1' }],
  activity: [],
  updatedAt: '2026-08-01T00:00:00.000Z',
});

describe('ImportCmsSchema', () => {
  describe('the read-side payload round trips', () => {
    it('accepts exactly what GET /cms returns', () => {
      const parsed = ImportCmsSchema.safeParse(snapshotFromApi());
      expect(parsed.success).toBe(true);
    });

    it('maps version onto schemaVersion', () => {
      const out = ImportCmsSchema.parse(snapshotFromApi());
      expect(out.schemaVersion).toBe(10);
    });

    it('maps consultations onto consultationTypes — the wipe this prevents', () => {
      const out = ImportCmsSchema.parse(snapshotFromApi());
      expect(out.consultationTypes).toHaveLength(3);
    });

    it('maps media onto mediaLibrary', () => {
      const out = ImportCmsSchema.parse(snapshotFromApi());
      expect(out.mediaLibrary).toHaveLength(1);
    });

    it('ignores read-only keys the snapshot carries', () => {
      // `activity` and `updatedAt` are server-owned; they must not break parsing.
      expect(ImportCmsSchema.safeParse(snapshotFromApi()).success).toBe(true);
    });
  });

  describe('the old spellings still work', () => {
    const legacy = {
      schemaVersion: 9,
      settings: {},
      consultationTypes: [{ key: 'a' }],
      mediaLibrary: [{ id: 'm' }],
    };

    it('accepts a payload using the original field names', () => {
      const out = ImportCmsSchema.parse(legacy);
      expect(out.schemaVersion).toBe(9);
      expect(out.consultationTypes).toHaveLength(1);
      expect(out.mediaLibrary).toHaveLength(1);
    });

    it('prefers the canonical name when a payload sends both', () => {
      const out = ImportCmsSchema.parse({
        schemaVersion: 9,
        version: 10,
        consultationTypes: [{ key: 'canonical' }],
        consultations: [{ key: 'read-side' }, { key: 'extra' }],
      });
      expect(out.schemaVersion).toBe(9);
      expect(out.consultationTypes).toEqual([{ key: 'canonical' }]);
    });
  });

  describe('omission is no longer deletion', () => {
    it('leaves an omitted collection undefined rather than empty', () => {
      const out = ImportCmsSchema.parse({ schemaVersion: 10, settings: {} });
      // `replaceState` reads undefined as "keep what is stored". An empty array
      // here is what used to overwrite every consultation type.
      expect(out.consultationTypes).toBeUndefined();
      expect(out.menu).toBeUndefined();
      expect(out.paymentMethods).toBeUndefined();
    });

    it('still honours an explicit empty array as a deliberate clear', () => {
      const out = ImportCmsSchema.parse({ schemaVersion: 10, consultationTypes: [] });
      expect(out.consultationTypes).toEqual([]);
    });
  });

  describe('version is still required', () => {
    it('rejects a payload with neither spelling', () => {
      const parsed = ImportCmsSchema.safeParse({ settings: {} });
      expect(parsed.success).toBe(false);
    });

    it('reports the failure against schemaVersion', () => {
      const parsed = ImportCmsSchema.safeParse({ settings: {} });
      if (parsed.success) throw new Error('expected a failure');
      expect(parsed.error.issues.some((i) => i.path.includes('schemaVersion'))).toBe(true);
    });
  });
});
