import { Injectable, Logger } from '@nestjs/common';
import { CMS_SCHEMA_VERSION } from '../common/constants/statuses';

@Injectable()
export class CmsMigrationService {
  private readonly logger = new Logger(CmsMigrationService.name);

  /**
   * Run all needed migrations from state.schemaVersion up to CMS_SCHEMA_VERSION.
   * Each migration is safe to re-run (backfill-on-read).
   */
  migrate(state: any): any {
    let current = state.schemaVersion ?? 0;
    const result = { ...state };

    if (current < 1) {
      current = 1;
      result.schemaVersion = 1;
    }

    if (current < 2) {
      this.logger.log('CMS migration 1 → 2: ensure mediaLibrary');
      result.mediaLibrary = result.mediaLibrary ?? [];
      result.schemaVersion = 2;
      current = 2;
    }

    if (current < 3) {
      this.logger.log('CMS migration 2 → 3: ensure consultationTypes');
      result.consultationTypes = result.consultationTypes ?? [];
      result.schemaVersion = 3;
      current = 3;
    }

    if (current < 4) {
      this.logger.log('CMS migration 3 → 4: ensure settings.stats defaults');
      result.settings = result.settings ?? {};
      result.settings.stats = result.settings.stats ?? {
        governorates: '12',
        beneficiaries: '1.2M+',
        yearsOfService: '+12',
      };
      result.schemaVersion = 4;
      current = 4;
    }

    if (current < 5) {
      this.logger.log('CMS migration 4 → 5: ensure paymentMethods');
      // Shape must match PaymentMethodInfo in the app's @ahla/shared: the Donate
      // screen reads id/group/description/availability/manual. The earlier
      // key/label/enabled/icon default did not match anything that consumes it,
      // so a fresh deploy or a CMS reset would have rendered no payment methods.
      // `manual: true` = waits on admin approval; false = waits on the gateway.
      result.paymentMethods = result.paymentMethods ?? [
        { id: 'بطاقة بنكية', group: 'دفع إلكتروني', description: 'فيزا / ماستركارد — تأكيد فوري من بوابة الدفع', availability: 'متاحة', manual: false },
        { id: 'فوري', group: 'دفع إلكتروني', description: 'ادفع بكود فوري من أقرب منفذ', availability: 'متاحة', manual: false },
        { id: 'إنستاباي', group: 'تحويل بنكي', description: 'حوِّل عبر إنستاباي — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
        { id: 'فودافون كاش', group: 'محفظة إلكترونية', description: 'الدفع عبر المحفظة الإلكترونية', availability: 'قيد التفعيل', manual: false },
        { id: 'تحويل بنكي', group: 'تحويل بنكي', description: 'تحويل على حساب الجمعية — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
      ];
      result.schemaVersion = 5;
      current = 5;
    }

    if (current < 6) {
      this.logger.log('CMS migration 5 → 6: align settings field names with the app');
      result.settings = result.settings ?? {};
      const st = result.settings;

      // Rename to the names the mobile app, dashboard store and shared types all
      // use. Backfill-on-read and idempotent: the old key is only consumed if the
      // new one is absent, then deleted.
      const RENAMES: Record<string, string> = {
        contactPhone: 'hotline',
        contactEmail: 'email',
        contactAddress: 'address',
        socialLinks: 'socials',
        zakatNisab: 'zakatNisabEgp',
      };
      for (const [from, to] of Object.entries(RENAMES)) {
        if (st[from] !== undefined) {
          st[to] = st[to] ?? st[from];
          delete st[from];
        }
      }

      // Settings the app reads but nothing ever populated.
      st.splashText = st.splashText ?? 'معاً نصنع أثراً يدوم';
      st.website = st.website ?? 'https://ahlashabab.com';
      st.donationReassurance =
        st.donationReassurance ??
        'لن يُعتمد تبرعك إلا بعد تأكيد العملية من بوابة الدفع أو مراجعة الإدارة.';
      st.socials = st.socials ?? { facebook: '', instagram: '', youtube: '', twitter: '' };

      result.schemaVersion = 6;
      current = 6;
    }

    // Future migrations go here (7, 8, ...)

    if (result.schemaVersion !== CMS_SCHEMA_VERSION) {
      this.logger.warn(
        `CMS state at schemaVersion ${result.schemaVersion}, expected ${CMS_SCHEMA_VERSION}`,
      );
    }

    return result;
  }
}
