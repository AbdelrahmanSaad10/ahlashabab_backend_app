import 'reflect-metadata';
import { integrationDb } from './db';
import { CmsService } from '../../src/cms/cms.service';
import { CmsMigrationService } from '../../src/cms/cms-migration.service';
import { CMS_SCHEMA_VERSION } from '../../src/common/constants/statuses';

/**
 * CMS — what the public snapshot does and does not expose.
 *
 * `cms.service.ts` had **0% coverage** and 128 statements, and it is the single
 * document the whole mobile app renders from: settings, menu, home layout, pages,
 * payment methods and consultation forms. Two properties matter most:
 *
 *  1. **Draft pages must not reach the public snapshot.** The dashboard's
 *     publish toggle is the only thing standing between an unfinished page and
 *     every app user.
 *  2. **The migration must run on read.** Migrations here are backfill-on-read
 *     (T-07's 10 → 11 is the worked example), so a stored document at an older
 *     version has to come back current — otherwise the app receives a shape it
 *     cannot render.
 */

const prisma = integrationDb();
const cms = new CmsService(prisma as any, new CmsMigrationService());

const TAG = 'INT-CMS';

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('the public snapshot hides unpublished pages', () => {
  let draftId: string;
  let livePageId: string;

  beforeAll(async () => {
    const draft: any = await cms.createPage({
      title: `${TAG}-draft`, slug: `${TAG}-draft`, status: 'draft', blocks: [],
    });
    draftId = draft.id;
    const live: any = await cms.createPage({
      title: `${TAG}-live`, slug: `${TAG}-live`, status: 'published', blocks: [],
    });
    livePageId = live.id;
  });

  afterAll(async () => {
    for (const id of [draftId, livePageId]) {
      await cms.deletePage(id).catch(() => undefined);
    }
  });

  it('a draft page is absent from the public snapshot', async () => {
    const snap: any = await cms.getPublicSnapshot();
    const ids = snap.pages.map((p: any) => p.id);
    expect(ids).toContain(livePageId);
    expect(ids).not.toContain(draftId);
  });

  it('the admin page list still contains the draft', async () => {
    const pages: any[] = await cms.getPages();
    expect(pages.map((p) => p.id)).toContain(draftId);
  });

  it('unpublishing removes a page from the snapshot', async () => {
    await cms.togglePagePublish(livePageId);
    try {
      const snap: any = await cms.getPublicSnapshot();
      expect(snap.pages.map((p: any) => p.id)).not.toContain(livePageId);
    } finally {
      await cms.togglePagePublish(livePageId);
    }
  });
});

describe('the snapshot is migrated on read', () => {
  it('reports the current schema version', async () => {
    const snap: any = await cms.getPublicSnapshot();
    expect(snap.version).toBe(CMS_SCHEMA_VERSION);
  });

  it('repairs a stored document left at an older version', async () => {
    const row = await prisma.cmsState.findUnique({ where: { id: 1 } });
    const originalVersion = row!.schemaVersion;
    const originalTypes = row!.consultationsJson;

    // Simulate a deployment that has not been read since before T-07.
    await prisma.cmsState.update({
      where: { id: 1 },
      data: { schemaVersion: 9, consultationsJson: [{ key: 'psychological', fields: [] }] as any },
    });

    try {
      const snap: any = await cms.getPublicSnapshot();
      expect(snap.version).toBe(CMS_SCHEMA_VERSION);
      // T-07: the English keys are replaced with the ones the app routes by.
      expect(snap.consultations.map((c: any) => c.key)).toEqual([
        'نفسية', 'دينية', 'طبية', 'أسرية', 'أعمال',
      ]);
      // and every type carries a consent-typed field
      for (const t of snap.consultations) {
        expect(t.fields.some((f: any) => f.type === 'consent')).toBe(true);
      }
    } finally {
      await prisma.cmsState.update({
        where: { id: 1 },
        data: { schemaVersion: originalVersion, consultationsJson: originalTypes as any },
      });
    }
  });
});

describe('the snapshot carries what the app needs to render', () => {
  it('includes settings, menu, home, payment methods and consultations', async () => {
    const snap: any = await cms.getPublicSnapshot();
    expect(snap.settings).toBeTruthy();
    expect(Array.isArray(snap.menu)).toBe(true);
    expect(snap.home).toBeTruthy();
    expect(snap.paymentMethods.length).toBeGreaterThan(0);
    expect(snap.consultations.length).toBe(5);
  });

  it('offers only the three client-approved payment methods', async () => {
    const snap: any = await cms.getPublicSnapshot();
    const ids = snap.paymentMethods.map((m: any) => m.id).sort();
    expect(ids).toEqual(['تحويل بنكي', 'فوري', 'فودافون كاش'].sort());
    // No card / gateway method may reappear — the client ruled them out.
    expect(ids).not.toContain('بطاقة بنكية');
    expect(ids).not.toContain('إنستاباي');
  });
});

describe('admin edits persist and reach the next public read', () => {
  it('a settings change is visible in the snapshot', async () => {
    const before: any = await cms.getPublicSnapshot();
    const original = before.settings.appName;
    try {
      await cms.updateSettings({ appName: `${TAG}-renamed` } as any);
      const after: any = await cms.getPublicSnapshot();
      expect(after.settings.appName).toBe(`${TAG}-renamed`);
    } finally {
      await cms.updateSettings({ appName: original } as any);
    }
  });

  it('an edit does not silently drop the rest of the document', async () => {
    // A partial update that clobbered menu/home/pages would be invisible until
    // the app rendered an empty screen.
    const before: any = await cms.getPublicSnapshot();
    const menuLen = before.menu.length;
    const original = before.settings.appName;
    try {
      await cms.updateSettings({ appName: `${TAG}-partial` } as any);
      const after: any = await cms.getPublicSnapshot();
      expect(after.menu.length).toBe(menuLen);
      expect(after.consultations.length).toBe(5);
    } finally {
      await cms.updateSettings({ appName: original } as any);
    }
  });
});
