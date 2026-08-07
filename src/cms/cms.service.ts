import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CmsMigrationService } from './cms-migration.service';
import {
  CMS_SCHEMA_VERSION,
  VALID_TABS,
  TAB_REMAPS,
} from '../common/constants/statuses';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ImportCmsDto } from './dto/import-cms.dto';

/** Shape returned by Prisma for the single cms_state row */
interface CmsRow {
  id: number;
  schemaVersion: number;
  settingsJson: any;
  menuJson: any;
  homeJson: any;
  pagesJson: any;
  paymentMethodsJson: any;
  consultationsJson: any;
  updatedAt: Date;
}

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly migration: CmsMigrationService,
  ) {}

  // ──────────────────────────────────────────────
  // Core state
  // ──────────────────────────────────────────────

  /** Get the single CMS state row, creating a default if empty */
  async getState(): Promise<CmsRow> {
    let row = await this.prisma.cmsState.findUnique({ where: { id: 1 } });

    if (!row) {
      row = await this.prisma.cmsState.create({
        data: {
          id: 1,
          schemaVersion: CMS_SCHEMA_VERSION,
          settingsJson: this.defaultSettings(),
          menuJson: [],
          homeJson: [],
          pagesJson: [],
          paymentMethodsJson: this.defaultPaymentMethods(),
          consultationsJson: [],
        },
      });
    }

    return row;
  }

  /** Public snapshot — same data shaped for mobile consumption */
  async getPublicSnapshot() {
    const row = await this.getState();
    const migrated = this.migration.migrate(this.rowToBlob(row));

    // Media lives in its own table, not in the CMS blob. The app resolves
    // imageId/mediaId against this list via getMediaSrc(), so omitting it makes
    // every CMS-authored image render as nothing. `srcUrl` is mapped to `src`,
    // which is what MediaItem in @ahla/shared expects.
    const mediaRows = await this.prisma.cmsMedia.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const media = mediaRows.map((m) => ({
      id: m.id,
      title: m.title,
      alt: m.alt,
      caption: m.caption,
      folder: m.folder,
      src: m.srcUrl,
      type: m.type,
      width: m.width,
      height: m.height,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    // Field names here are the app's contract (CmsState in @ahla/shared), not the
    // column names. `version` and `consultations` are what the mobile app, the
    // dashboard store, the CMS migrations and the test suite all read.
    return {
      version: migrated.schemaVersion,
      settings: migrated.settings,
      menu: migrated.menu,
      home: migrated.home,
      pages: (migrated.pages as any[]).filter((p: any) => p.status === 'published'),
      media,
      paymentMethods: migrated.paymentMethods,
      consultations: migrated.consultationTypes,
      // The app's CmsState types `activity` as required, so send it — but always
      // empty here: the audit log is admin-only and must not leak to a public,
      // unauthenticated endpoint. Real entries come from GET /admin/activity.
      activity: [],
      updatedAt: row.updatedAt ?? null,
    };
  }

  /** Full replace of CMS state with schema version validation */
  /**
   * Full replace of the CMS state.
   *
   * A field the caller OMITS keeps whatever is stored, rather than being reset.
   * Previously `ImportCmsSchema` defaulted every array to `[]` and this method
   * wrote that default, so a payload missing `consultationTypes` silently
   * replaced every consultation type with an empty array. An explicit `[]` still
   * clears a collection — the difference is between "clear this" and "I did not
   * mention this" (issue #7).
   */
  async replaceState(state: any) {
    const migrated = this.migration.migrate(state);
    const current = await this.getState();

    const keep = <T>(incoming: T | undefined, stored: T): T =>
      incoming === undefined ? stored : incoming;

    const data = {
      schemaVersion: migrated.schemaVersion ?? current.schemaVersion,
      settingsJson: keep(migrated.settings, current.settingsJson as any),
      menuJson: keep(migrated.menu, current.menuJson as any),
      homeJson: keep(migrated.home, current.homeJson as any),
      pagesJson: keep(migrated.pages, current.pagesJson as any),
      paymentMethodsJson: keep(migrated.paymentMethods, current.paymentMethodsJson as any),
      consultationsJson: keep(migrated.consultationTypes, current.consultationsJson as any),
    };

    return this.prisma.cmsState.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  }

  /** Merge partial settings into settings_json */
  async updateSettings(partial: UpdateSettingsDto) {
    const row = await this.getState();
    const current = (row.settingsJson as Record<string, any>) ?? {};
    const merged = { ...current, ...partial };

    return this.prisma.cmsState.update({
      where: { id: 1 },
      data: { settingsJson: merged },
    });
  }

  /** Replace menu_json after validating NavTarget tabs */
  async replaceMenu(menuGroups: any[]) {
    this.validateMenuTabs(menuGroups);

    return this.prisma.cmsState.update({
      where: { id: 1 },
      data: { menuJson: menuGroups },
    });
  }

  /** Replace home_json */
  async replaceHome(sections: any[]) {
    return this.prisma.cmsState.update({
      where: { id: 1 },
      data: { homeJson: sections },
    });
  }

  // ──────────────────────────────────────────────
  // Pages CRUD (stored in pages_json array)
  // ──────────────────────────────────────────────

  async getPages(): Promise<any[]> {
    const row = await this.getState();
    return (row.pagesJson as any[]) ?? [];
  }

  async createPage(page: any) {
    const row = await this.getState();
    const pages = (row.pagesJson as any[]) ?? [];

    const newPage = {
      ...page,
      id: page.id ?? this.generateId(),
      status: page.status ?? 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    pages.push(newPage);

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { pagesJson: pages },
    });

    return newPage;
  }

  async updatePage(id: string, updates: any) {
    const row = await this.getState();
    const pages = (row.pagesJson as any[]) ?? [];
    const idx = pages.findIndex((p: any) => p.id === id);

    if (idx === -1) {
      throw new NotFoundException('الصفحة غير موجودة');
    }

    pages[idx] = {
      ...pages[idx],
      ...updates,
      id, // preserve id
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { pagesJson: pages },
    });

    return pages[idx];
  }

  async deletePage(id: string) {
    const row = await this.getState();
    const pages = (row.pagesJson as any[]) ?? [];
    const idx = pages.findIndex((p: any) => p.id === id);

    if (idx === -1) {
      throw new NotFoundException('الصفحة غير موجودة');
    }

    const [removed] = pages.splice(idx, 1);

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { pagesJson: pages },
    });

    return removed;
  }

  async togglePagePublish(id: string) {
    const row = await this.getState();
    const pages = (row.pagesJson as any[]) ?? [];
    const idx = pages.findIndex((p: any) => p.id === id);

    if (idx === -1) {
      throw new NotFoundException('الصفحة غير موجودة');
    }

    pages[idx].status = pages[idx].status === 'published' ? 'draft' : 'published';
    pages[idx].updatedAt = new Date().toISOString();

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { pagesJson: pages },
    });

    return pages[idx];
  }

  // ──────────────────────────────────────────────
  // Consultation Types CRUD (stored in consultations_json)
  // ──────────────────────────────────────────────

  async getConsultationTypes(): Promise<any[]> {
    const row = await this.getState();
    return (row.consultationsJson as any[]) ?? [];
  }

  async createConsultationType(config: any) {
    const row = await this.getState();
    const types = (row.consultationsJson as any[]) ?? [];

    const newType = {
      ...config,
      key: config.key ?? this.generateId(),
      createdAt: new Date().toISOString(),
    };

    // Ensure unique key
    if (types.some((t: any) => t.key === newType.key)) {
      throw new BadRequestException('مفتاح نوع الاستشارة مستخدم بالفعل');
    }

    types.push(newType);

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { consultationsJson: types },
    });

    return newType;
  }

  async updateConsultationType(key: string, config: any) {
    const row = await this.getState();
    const types = (row.consultationsJson as any[]) ?? [];
    const idx = types.findIndex((t: any) => t.key === key);

    if (idx === -1) {
      throw new NotFoundException('نوع الاستشارة غير موجود');
    }

    types[idx] = {
      ...types[idx],
      ...config,
      key, // preserve key
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { consultationsJson: types },
    });

    return types[idx];
  }

  async deleteConsultationType(key: string) {
    const row = await this.getState();
    const types = (row.consultationsJson as any[]) ?? [];
    const idx = types.findIndex((t: any) => t.key === key);

    if (idx === -1) {
      throw new NotFoundException('نوع الاستشارة غير موجود');
    }

    const [removed] = types.splice(idx, 1);

    await this.prisma.cmsState.update({
      where: { id: 1 },
      data: { consultationsJson: types },
    });

    return removed;
  }

  // ──────────────────────────────────────────────
  // Tools: export / import / backup
  // ──────────────────────────────────────────────

  async exportState() {
    const row = await this.getState();
    return this.rowToBlob(row);
  }

  async importState(blob: ImportCmsDto) {
    // Create backup before destructive import
    await this.createBackup();

    const migrated = this.migration.migrate({
      schemaVersion: blob.schemaVersion,
      settings: blob.settings,
      menu: blob.menu,
      home: blob.home,
      pages: blob.pages,
      paymentMethods: blob.paymentMethods,
      consultationTypes: blob.consultationTypes,
      mediaLibrary: blob.mediaLibrary,
    });

    await this.replaceState(migrated);

    return { message: 'تم استيراد بيانات CMS بنجاح' };
  }

  /** Snapshot the current state into cms_backups or a timestamped JSON field */
  async createBackup() {
    const row = await this.getState();
    const blob = this.rowToBlob(row);

    // Store backup as an activity log entry with the full blob
    // This leverages the existing activity_log table for audit trail
    try {
      await this.prisma.activityLog.create({
        data: {
          actorId: 'system',
          action: 'cms_backup',
          entityType: 'cms_state',
          entityId: '1',
          previousValue: blob,
          newValue: Prisma.JsonNull,
        },
      });
    } catch {
      // If activity log fails (e.g. foreign key on actorId),
      // log but don't block the operation
      this.logger.warn('Could not persist CMS backup to activity log; continuing.');
    }

    return {
      message: 'تم إنشاء نسخة احتياطية',
      timestamp: new Date().toISOString(),
      schemaVersion: blob.schemaVersion,
    };
  }

  // ──────────────────────────────────────────────
  // NavTarget validation
  // ──────────────────────────────────────────────

  private validateMenuTabs(menuGroups: any[]) {
    for (const group of menuGroups) {
      const items = group?.items ?? group?.children ?? [];
      for (const item of items) {
        if (item?.navTarget?.tab) {
          let tab = item.navTarget.tab;

          // Remap legacy tab names
          if (TAB_REMAPS[tab]) {
            item.navTarget.tab = TAB_REMAPS[tab];
            tab = item.navTarget.tab;
          }

          // Validate against allowed tabs
          if (!VALID_TABS.includes(tab) && !Object.values(TAB_REMAPS).includes(tab)) {
            throw new BadRequestException(
              `تبويب غير صالح: "${tab}". التبويبات المسموحة: ${VALID_TABS.join(', ')}`,
            );
          }
        }

        // Recurse into nested children
        if (item?.children?.length) {
          this.validateMenuTabs([{ items: item.children }]);
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private rowToBlob(row: CmsRow) {
    return {
      schemaVersion: row.schemaVersion,
      settings: row.settingsJson,
      menu: row.menuJson,
      home: row.homeJson,
      pages: row.pagesJson,
      paymentMethods: row.paymentMethodsJson,
      consultationTypes: row.consultationsJson,
    };
  }

  /**
   * Settings for a brand-new install.
   *
   * IMPORTANT: `getState()` creates the first row already stamped at
   * CMS_SCHEMA_VERSION, so `migrate()` runs no migrations against it. That means
   * these defaults — not the migration backfills — are what a fresh deployment
   * actually gets. They must therefore always represent the CURRENT schema in
   * full. Any future migration that backfills a field has to add it here too, or
   * new installs will silently lack it.
   *
   * Shape is CmsSettings from the app's @ahla/shared. Previously this returned
   * only foundationName/tagline/logoUrl, none of which the app reads, so a fresh
   * install served settings the app could not use at all.
   */
  private defaultSettings() {
    return {
      appName: 'خواطر أحلى شباب',
      heroTitle: 'جمعية خواطر أحلى شباب',
      heroSubtitle: 'جمعية خيرية مصرية — تبرعات موثوقة وخدمات مجانية للأسر الأولى بالرعاية.',
      splashText: 'معاً نصنع أثراً يدوم',
      primaryColor: '#18489F',
      secondaryColor: '#E9AF31',
      hotline: '',
      email: '',
      address: '',
      workingHours: '',
      website: 'https://ahlashabab.com',
      socials: { facebook: '', instagram: '', youtube: '', twitter: '' },
      zakatNisabEgp: 357000,
      donationReassurance:
        'لن يُعتمد تبرعك إلا بعد تأكيد العملية من بوابة الدفع أو مراجعة الإدارة.',
      demoLabel: '',
      stats: {
        governorates: '12',
        beneficiaries: '1.2M+',
        yearsOfService: '+12',
      },
      // Added by migration 7 -> 8. Per the note above, a backfilled field has to
      // appear here too or a fresh install silently lacks it.
      milestones: [
        { year: '2013', label: 'بداية الفكرة' },
        { year: '2015', label: 'أول قافلة إغاثية' },
        { year: '2019', label: 'توسع في المحافظات' },
        { year: '2022', label: 'إطلاق وصلات المياه' },
        { year: '2025', label: 'مستمرون بفضلكم' },
      ],
    };
  }

  /**
   * Shape is PaymentMethodInfo from the app's @ahla/shared — the Donate screen
   * reads id/group/description/availability/manual. The previous
   * key/label/enabled/icon shape matched nothing that consumes it, so a fresh
   * install rendered no payment methods at all.
   *
   * `manual: true` = the donation waits on admin review (قيد المراجعة);
   * `false` = it waits on the gateway callback (قيد التأكيد). The app never marks
   * a donation successful on its own.
   */
  private defaultPaymentMethods() {
    return [
      { id: 'تحويل بنكي', label: 'تحويل بنكي / إنستاباي', group: 'تحويل بنكي', description: 'حوِّل إلى حساب الجمعية في بنك CIB من أي تطبيق بنكي أو عبر إنستاباي.', availability: 'متاحة', manual: true, copyables: [{ label: 'اسم الحساب', value: 'khawaterahlashabab' }, { label: 'رقم الحساب', value: '100063461509' }], instructions: ['البنك: CIB — البنك التجاري الدولي', 'اسم الحساب: khawaterahlashabab', 'رقم الحساب: 100063461509', 'يمكنك التحويل من تطبيق البنك أو من إنستاباي على نفس الحساب.'] },
      { id: 'فوري', label: 'فوري', group: 'دفع إلكتروني', description: 'ادفع من أقرب منفذ فوري باستخدام كود التبرع.', availability: 'متاحة', manual: true, copyables: [{ label: 'كود التبرع', value: '74000' }], instructions: ['توجّه إلى أقرب منفذ فوري.', 'اطلب خدمة التبرعات وأدخل كود التبرع: 74000', 'تأكد من ظهور الاسم: جمعية خواطر أحلى شباب'] },
      { id: 'فودافون كاش', label: 'فودافون كاش', group: 'محفظة إلكترونية', description: 'تبرّع من محفظة فودافون كاش بكود التبرع أو عبر «ميجا خير».', availability: 'متاحة', manual: true, copyables: [{ label: 'كود التبرع', value: '#237*9*' }], instructions: ['اطلب كود التبرع من هاتفك: #237*9*', 'أو من تطبيق «أنا فودافون»: اختر التبرعات ثم «ميجا خير»، ثم جمعية خواطر أحلى شباب.'] },
    ];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
