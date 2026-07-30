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

    return {
      schemaVersion: migrated.schemaVersion,
      settings: migrated.settings,
      menu: migrated.menu,
      home: migrated.home,
      pages: (migrated.pages as any[]).filter((p: any) => p.status === 'published'),
      paymentMethods: migrated.paymentMethods,
      consultationTypes: migrated.consultationTypes,
    };
  }

  /** Full replace of CMS state with schema version validation */
  async replaceState(state: any) {
    const migrated = this.migration.migrate(state);

    return this.prisma.cmsState.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        schemaVersion: migrated.schemaVersion,
        settingsJson: migrated.settings ?? {},
        menuJson: migrated.menu ?? [],
        homeJson: migrated.home ?? [],
        pagesJson: migrated.pages ?? [],
        paymentMethodsJson: migrated.paymentMethods ?? [],
        consultationsJson: migrated.consultationTypes ?? [],
      },
      update: {
        schemaVersion: migrated.schemaVersion,
        settingsJson: migrated.settings ?? {},
        menuJson: migrated.menu ?? [],
        homeJson: migrated.home ?? [],
        pagesJson: migrated.pages ?? [],
        paymentMethodsJson: migrated.paymentMethods ?? [],
        consultationsJson: migrated.consultationTypes ?? [],
      },
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

  private defaultSettings() {
    return {
      foundationName: 'أهل الشباب',
      tagline: '',
      logoUrl: '',
      stats: {
        governorates: '12',
        beneficiaries: '1.2M+',
        yearsOfService: '+12',
      },
    };
  }

  private defaultPaymentMethods() {
    return [
      { key: 'card', label: 'بطاقة بنكية', enabled: true, icon: 'credit-card' },
      { key: 'fawry', label: 'فوري', enabled: true, icon: 'fawry' },
      { key: 'instapay', label: 'إنستاباي', enabled: true, icon: 'instapay' },
      { key: 'vodafone_cash', label: 'فودافون كاش', enabled: true, icon: 'vodafone' },
      { key: 'bank_transfer', label: 'تحويل بنكي', enabled: true, icon: 'bank' },
    ];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
