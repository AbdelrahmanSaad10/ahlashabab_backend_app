import 'reflect-metadata';
import { CmsMigrationService } from '../src/cms/cms-migration.service';
import { CMS_SCHEMA_VERSION } from '../src/common/constants/statuses';

/**
 * The CMS migrations are backfill-on-read and run only when
 * `current < N`, so a step can never be revisited once a deployment has passed
 * it. That has already caught us twice:
 *
 *   - `splashText` / `website` / `donationReassurance` were added to 5 -> 6,
 *     which is fine only because the deployment was still on 5.
 *   - `milestones` was created in 6 -> 7 but left as `[]`. Deployments that had
 *     already run 6 -> 7 served an empty timeline forever, and editing that step
 *     would not have reached them — hence 7 -> 8.
 *
 * These assert the property that keeps biting: a state at ANY older version must
 * end up fully populated, and anything an admin has already set must survive.
 */
describe('CMS migrations', () => {
  const migrate = (state: any) => new CmsMigrationService().migrate(state);

  it('brings a v7 state with an empty milestones array up to date', () => {
    const out = migrate({ schemaVersion: 7, settings: { milestones: [] } });
    expect(out.schemaVersion).toBe(CMS_SCHEMA_VERSION);
    expect(out.settings.milestones.length).toBeGreaterThan(0);
    expect(out.settings.milestones[0]).toEqual({ year: '2013', label: 'بداية الفكرة' });
  });

  it('never overwrites milestones an admin has already entered', () => {
    const mine = [{ year: '2020', label: 'حدث خاص' }];
    const out = migrate({ schemaVersion: 7, settings: { milestones: mine } });
    expect(out.settings.milestones).toEqual(mine);
  });

  it('populates milestones from every older version too', () => {
    for (const from of [0, 4, 5, 6, 7]) {
      const out = migrate({ schemaVersion: from, settings: {} });
      expect(out.schemaVersion).toBe(CMS_SCHEMA_VERSION);
      expect(out.settings.milestones?.length).toBeGreaterThan(0);
    }
  });

  describe('the production state — version 10, past every gate', () => {
    // Reproduces what portfolio.27lashabab.com actually served: schemaVersion 10
    // with 5 consultation types and 2 menu groups (so not a fresh install), yet
    // no splashText (added by 5 -> 6) and no milestones (added by 7 -> 8).
    // replaceState() migrates the INCOMING payload, so a PUT /admin/cms carrying
    // an already-high schemaVersion skips every gate and is stored verbatim.
    const production = () => ({
      schemaVersion: 10,
      settings: { appName: 'خواطر أحلى شباب', hotline: '19XXX' },
      consultationTypes: [{ key: 'psychological' }],
      menu: [{ id: 'g1' }, { id: 'g2' }],
    });

    it('restores the fields the gated steps can no longer reach', () => {
      const out = migrate(production());
      expect(out.settings.milestones.length).toBeGreaterThan(0);
      expect(out.settings.splashText).toBeTruthy();
      expect(out.settings.donationReassurance).toBeTruthy();
      expect(out.settings.socials).toEqual({ facebook: '', instagram: '', youtube: '', twitter: '' });
      expect(out.settings.stats.governorates).toBeTruthy();
    });

    it('leaves everything the admin set alone', () => {
      const out = migrate(production());
      expect(out.settings.appName).toBe('خواطر أحلى شباب');
      expect(out.settings.hotline).toBe('19XXX');
    });

    it('does not invent contact details that would be shown to users', () => {
      const out = migrate({ schemaVersion: 10, settings: {} });
      expect(out.settings.email).toBeUndefined();
      expect(out.settings.address).toBeUndefined();
    });
  });

  it('is idempotent — migrating an already-current state changes nothing', () => {
    const once = migrate({ schemaVersion: 0, settings: {} });
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('still applies the 5 -> 6 renames and does not resurrect the old keys', () => {
    const out = migrate({
      schemaVersion: 5,
      settings: { contactPhone: '19XXX', contactEmail: 'a@b.co', zakatNisab: 357000 },
    });
    expect(out.settings.hotline).toBe('19XXX');
    expect(out.settings.email).toBe('a@b.co');
    expect(out.settings.zakatNisabEgp).toBe(357000);
    expect(out.settings.contactPhone).toBeUndefined();
    expect(out.settings.contactEmail).toBeUndefined();
  });
});
