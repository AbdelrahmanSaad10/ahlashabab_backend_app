import { PrismaClient } from '@prisma/client';
// Single source of truth, shared with the CMS migration — see that file for why
// the keys are Arabic and the consent field is typed `consent` (T-07).
import { DEFAULT_CONSULTATION_TYPES } from '../../src/cms/default-consultation-types';
// Was hardcoded to 10 and would have gone stale on the next bump, leaving the
// seed writing a version the migration then had to repair on every read.
import { CMS_SCHEMA_VERSION } from '../../src/common/constants/statuses';
import { preserve } from './seed-mode';

const DEFAULT_SETTINGS = {
  appName: 'أحلى شباب',
  primaryColor: '#1B6B4A',
  secondaryColor: '#F59E0B',
  heroTitle: 'جمعية خواطر أحلى شباب',
  heroSubtitle: 'معاً نبني مجتمعاً أفضل',
  contactPhone: '01000000000',
  contactEmail: 'info@ahlashabab.com',
  contactAddress: 'القاهرة، مصر',
  workingHours: 'السبت - الخميس: 9 صباحاً - 5 مساءً',
  socialLinks: {
    facebook: '',
    twitter: '',
    instagram: '',
    youtube: '',
    website: 'https://ahlashabab.com',
  },
  zakatNisab: 250000,
  demoLabel: true,
  stats: {
    governorates: '12',
    beneficiaries: '1.2M+',
    yearsOfService: '+12',
  },
};

const DEFAULT_MENU = [
  {
    id: 'main',
    title: 'القائمة الرئيسية',
    items: [
      { id: 'home', label: 'الرئيسية', icon: 'home', target: { kind: 'tab', tab: 'Home' } },
      { id: 'cases', label: 'الحالات', icon: 'heart', target: { kind: 'tab', tab: 'Cases' } },
      { id: 'urgent', label: 'حالات عاجلة', icon: 'alert-circle', target: { kind: 'tab', tab: 'UrgentCases' } },
      { id: 'donate', label: 'تبرع', icon: 'gift', target: { kind: 'tab', tab: 'Donate' } },
      { id: 'consult', label: 'الاستشارات', icon: 'message-circle', target: { kind: 'tab', tab: 'Consultations' } },
      { id: 'about', label: 'عن الجمعية', icon: 'info', target: { kind: 'tab', tab: 'About' } },
    ],
  },
  {
    id: 'services',
    title: 'الخدمات',
    items: [
      { id: 'browse', label: 'تصفح الخدمات', icon: 'grid', target: { kind: 'route', route: 'ServicesBrowse' } },
      { id: 'volunteer', label: 'تطوع معنا', icon: 'users', target: { kind: 'route', route: 'Volunteer' } },
      { id: 'news', label: 'الأخبار', icon: 'file-text', target: { kind: 'route', route: 'NewsFeed' } },
      { id: 'faq', label: 'الأسئلة الشائعة', icon: 'help-circle', target: { kind: 'route', route: 'Faq' } },
      { id: 'contact', label: 'تواصل معنا', icon: 'phone', target: { kind: 'route', route: 'ContactUs' } },
    ],
  },
];

const DEFAULT_HOME = [
  { id: 'hero', type: 'hero', enabled: true, config: {} },
  { id: 'impact', type: 'impactStats', enabled: true, config: {} },
  { id: 'workAreas', type: 'workAreas', enabled: true, config: {} },
  { id: 'quickServices', type: 'quickServices', enabled: true, config: { itemCount: 6 } },
  { id: 'urgentCases', type: 'urgentCases', enabled: true, config: { itemCount: 3 } },
  { id: 'sponsorship', type: 'sponsorship', enabled: true, config: { itemCount: 3 } },
  { id: 'featuredProjects', type: 'featuredProjects', enabled: true, config: { itemCount: 3 } },
  { id: 'latestNews', type: 'latestNews', enabled: true, config: { itemCount: 4 } },
  { id: 'consultations', type: 'consultations', enabled: true, config: {} },
  { id: 'donationCta', type: 'donationCta', enabled: true, config: {} },
  { id: 'volunteerCta', type: 'volunteerCta', enabled: true, config: {} },
  { id: 'contactCta', type: 'contactCta', enabled: true, config: {} },
  { id: 'faqPreview', type: 'faqPreview', enabled: true, config: { itemCount: 5 } },
];

const DEFAULT_PAGES = [
  {
    id: 'about',
    slug: 'about',
    title: 'عن الجمعية',
    builtin: true,
    status: 'published',
    template: 'default',
    sections: [],
  },
  {
    id: 'privacy',
    slug: 'privacy',
    title: 'سياسة الخصوصية',
    builtin: false,
    status: 'published',
    template: 'default',
    sections: [
      {
        id: 'privacy-content',
        blocks: [
          { type: 'heading', content: 'سياسة الخصوصية' },
          { type: 'paragraph', content: 'نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.' },
        ],
      },
    ],
  },
];

const DEFAULT_PAYMENT_METHODS = [
  { id: 'تحويل بنكي', label: 'تحويل بنكي / إنستاباي', group: 'تحويل بنكي', description: 'حوِّل إلى حساب الجمعية في بنك CIB من أي تطبيق بنكي أو عبر إنستاباي.', availability: 'متاحة', manual: true, copyables: [{ label: 'اسم الحساب', value: 'khawaterahlashabab' }, { label: 'رقم الحساب', value: '100063461509' }], instructions: ['البنك: CIB — البنك التجاري الدولي', 'اسم الحساب: khawaterahlashabab', 'رقم الحساب: 100063461509', 'يمكنك التحويل من تطبيق البنك أو من إنستاباي على نفس الحساب.'] },
  { id: 'فوري', label: 'فوري', group: 'دفع إلكتروني', description: 'ادفع من أقرب منفذ فوري باستخدام كود التبرع.', availability: 'متاحة', manual: true, copyables: [{ label: 'كود التبرع', value: '74000' }], instructions: ['توجّه إلى أقرب منفذ فوري.', 'اطلب خدمة التبرعات وأدخل كود التبرع: 74000', 'تأكد من ظهور الاسم: جمعية خواطر أحلى شباب'] },
  { id: 'فودافون كاش', label: 'فودافون كاش', group: 'محفظة إلكترونية', description: 'تبرّع من محفظة فودافون كاش بكود التبرع أو عبر «ميجا خير».', availability: 'متاحة', manual: true, copyables: [{ label: 'كود التبرع', value: '#237*9*' }], instructions: ['اطلب كود التبرع من هاتفك: #237*9*', 'أو من تطبيق «أنا فودافون»: اختر التبرعات ثم «ميجا خير»، ثم جمعية خواطر أحلى شباب.'] },
];


export async function seedCmsState(prisma: PrismaClient) {
  console.log('  Seeding CMS state...');

  await prisma.cmsState.upsert({
    where: { id: 1 },
    update: preserve({
      schemaVersion: CMS_SCHEMA_VERSION,
      settingsJson: DEFAULT_SETTINGS,
      menuJson: DEFAULT_MENU,
      homeJson: DEFAULT_HOME,
      pagesJson: DEFAULT_PAGES,
      paymentMethodsJson: DEFAULT_PAYMENT_METHODS,
      consultationsJson: DEFAULT_CONSULTATION_TYPES,
    }),
    create: {
      id: 1,
      schemaVersion: CMS_SCHEMA_VERSION,
      settingsJson: DEFAULT_SETTINGS,
      menuJson: DEFAULT_MENU,
      homeJson: DEFAULT_HOME,
      pagesJson: DEFAULT_PAGES,
      paymentMethodsJson: DEFAULT_PAYMENT_METHODS,
      consultationsJson: DEFAULT_CONSULTATION_TYPES,
    },
  });

  console.log(`  ✓ CMS state (schema v${CMS_SCHEMA_VERSION})`);
}
