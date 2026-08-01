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

      st.splashText = st.splashText ?? 'معاً نصنع أثراً يدوم';
      st.website = st.website ?? 'https://ahlashabab.com';
      st.donationReassurance =
        st.donationReassurance ??
        'لن يُعتمد تبرعك إلا بعد تأكيد العملية من بوابة الدفع أو مراجعة الإدارة.';
      st.socials = st.socials ?? { facebook: '', instagram: '', youtube: '', twitter: '' };

      result.schemaVersion = 6;
      current = 6;
    }

    if (current < 7) {
      this.logger.log('CMS migration 6 → 7: ensure settings.milestones');
      result.settings = result.settings ?? {};
      result.settings.milestones = result.settings.milestones ?? [];
      result.schemaVersion = 7;
      current = 7;
    }

    if (current < 8) {
      this.logger.log('CMS migration 7 → 8: populate settings.milestones');
      result.settings = result.settings ?? {};

      if (!result.settings.milestones?.length) {
        result.settings.milestones = [
          { year: '2013', label: 'بداية الفكرة' },
          { year: '2015', label: 'أول قافلة إغاثية' },
          { year: '2019', label: 'توسع في المحافظات' },
          { year: '2022', label: 'إطلاق وصلات المياه' },
          { year: '2025', label: 'مستمرون بفضلكم' },
        ];
      }

      result.schemaVersion = 8;
      current = 8;
    }

    if (current < 9) {
      this.logger.log('CMS migration 8 → 9: seed consultation types with disclaimer/consent/options');
      const types = result.consultationTypes ?? [];
      const hasDisclaimer = types.some((t: any) => t.disclaimer);
      if (!hasDisclaimer) {
        result.consultationTypes = [
          {
            key: 'psychological', label: 'استشارة نفسية', icon: 'brain',
            disclaimer: 'هذه الخدمة لا تغني عن زيارة طبيب متخصص في الحالات الطارئة.',
            fields: [
              { key: 'name', label: 'الاسم', type: 'text', required: true },
              { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
              { key: 'age', label: 'العمر', type: 'number', required: false },
              { key: 'gender', label: 'النوع', type: 'select', required: false, options: ['ذكر', 'أنثى'] },
              { key: 'preferredChannel', label: 'وسيلة التواصل المفضلة', type: 'select', required: false, options: ['هاتف', 'واتساب', 'حضوري'] },
              { key: 'preferredTime', label: 'الوقت المفضل', type: 'select', required: false, options: ['صباحاً', 'ظهراً', 'مساءً'] },
              { key: 'summary', label: 'ملخص المشكلة', type: 'textarea', required: false },
              { key: 'consent', label: 'أوافق على سياسة الخصوصية وشروط الاستخدام', type: 'checkbox', required: true },
            ],
          },
          {
            key: 'legal', label: 'استشارة قانونية', icon: 'scale',
            disclaimer: 'هذه الاستشارة استرشادية ولا تمثل رأياً قانونياً ملزماً.',
            fields: [
              { key: 'name', label: 'الاسم', type: 'text', required: true },
              { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
              { key: 'caseType', label: 'نوع القضية', type: 'select', required: true, options: ['أحوال شخصية', 'قضايا عمالية', 'نزاعات مالية', 'أخرى'] },
              { key: 'summary', label: 'تفاصيل القضية', type: 'textarea', required: true },
              { key: 'consent', label: 'أوافق على سياسة الخصوصية وشروط الاستخدام', type: 'checkbox', required: true },
            ],
          },
          {
            key: 'family', label: 'استشارة أسرية', icon: 'users',
            disclaimer: 'جميع المعلومات سرية ولا يتم مشاركتها مع أي طرف.',
            fields: [
              { key: 'name', label: 'الاسم', type: 'text', required: true },
              { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
              { key: 'familySize', label: 'عدد أفراد الأسرة', type: 'number', required: false },
              { key: 'preferredChannel', label: 'وسيلة التواصل المفضلة', type: 'select', required: false, options: ['هاتف', 'واتساب', 'حضوري'] },
              { key: 'summary', label: 'وصف المشكلة', type: 'textarea', required: false },
              { key: 'consent', label: 'أوافق على سياسة الخصوصية وشروط الاستخدام', type: 'checkbox', required: true },
            ],
          },
          {
            key: 'social', label: 'استشارة اجتماعية', icon: 'home',
            disclaimer: 'خدمة مجانية مقدمة من جمعية خواطر أحلى شباب.',
            fields: [
              { key: 'name', label: 'الاسم', type: 'text', required: true },
              { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
              { key: 'governorate', label: 'المحافظة', type: 'governorate', required: false },
              { key: 'summary', label: 'وصف الحالة', type: 'textarea', required: false },
              { key: 'consent', label: 'أوافق على سياسة الخصوصية وشروط الاستخدام', type: 'checkbox', required: true },
            ],
          },
          {
            key: 'educational', label: 'استشارة تعليمية', icon: 'book',
            disclaimer: 'خدمة مجانية مقدمة من جمعية خواطر أحلى شباب.',
            fields: [
              { key: 'name', label: 'الاسم', type: 'text', required: true },
              { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
              { key: 'age', label: 'العمر', type: 'number', required: false },
              { key: 'educationLevel', label: 'المرحلة التعليمية', type: 'select', required: false, options: ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعي'] },
              { key: 'summary', label: 'تفاصيل الاستشارة', type: 'textarea', required: false },
              { key: 'consent', label: 'أوافق على سياسة الخصوصية وشروط الاستخدام', type: 'checkbox', required: true },
            ],
          },
        ];
      }
      result.schemaVersion = 9;
      current = 9;
    }

    if (current < 10) {
      this.logger.log('CMS migration 9 → 10: normalise paymentMethods to Arabic id/group shape');
      const methods = result.paymentMethods ?? [];
      const LATIN_TO_ARABIC: Record<string, { id: string; group: string; description: string; availability: string; manual: boolean }> = {
        card: { id: 'بطاقة بنكية', group: 'دفع إلكتروني', description: 'فيزا / ماستركارد — تأكيد فوري من بوابة الدفع', availability: 'متاحة', manual: false },
        fawry: { id: 'فوري', group: 'دفع إلكتروني', description: 'ادفع بكود فوري من أقرب منفذ', availability: 'متاحة', manual: false },
        instapay: { id: 'إنستاباي', group: 'تحويل بنكي', description: 'حوِّل عبر إنستاباي — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
        vodafone_cash: { id: 'فودافون كاش', group: 'محفظة إلكترونية', description: 'الدفع عبر المحفظة الإلكترونية', availability: 'قيد التفعيل', manual: false },
        bank_transfer: { id: 'تحويل بنكي', group: 'تحويل بنكي', description: 'تحويل على حساب الجمعية — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
      };
      const hasLatinKeys = methods.some((m: any) => m.key && LATIN_TO_ARABIC[m.key]);
      if (hasLatinKeys) {
        result.paymentMethods = methods.map((m: any) => {
          const mapped = LATIN_TO_ARABIC[m.key];
          return mapped ? { ...mapped } : m;
        });
      }
      result.schemaVersion = 10;
      current = 10;
    }

    // Future migrations go here (11, 12, ...)

    if (result.schemaVersion !== CMS_SCHEMA_VERSION) {
      this.logger.warn(
        `CMS state at schemaVersion ${result.schemaVersion}, expected ${CMS_SCHEMA_VERSION}`,
      );
    }

    return result;
  }
}
