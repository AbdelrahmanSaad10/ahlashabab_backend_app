import { PrismaClient } from '@prisma/client';

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
  { id: 'card', group: 'إلكتروني', description: 'الدفع بالبطاقة البنكية', availability: 'متاحة', manual: false },
  { id: 'fawry', group: 'إلكتروني', description: 'الدفع عبر فوري', availability: 'قيد التفعيل', manual: true },
  { id: 'instapay', group: 'تحويل', description: 'تحويل عبر إنستاباي', availability: 'متاحة', manual: true },
  { id: 'vodafone', group: 'محفظة', description: 'فودافون كاش', availability: 'متاحة', manual: true },
  { id: 'bank', group: 'تحويل', description: 'تحويل بنكي مباشر', availability: 'متاحة', manual: true },
];

const DEFAULT_CONSULTATION_TYPES = [
  {
    key: 'psychological',
    label: 'استشارة نفسية',
    icon: 'brain',
    description: 'استشارات الدعم النفسي والإرشاد',
    enabled: true,
    fields: [
      { key: 'name', label: 'الاسم الكامل', type: 'text', required: true },
      { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
      { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
      { key: 'age', label: 'العمر', type: 'age', required: false },
      { key: 'governorate', label: 'المحافظة', type: 'governorate', required: true },
      { key: 'preferredChannel', label: 'وسيلة التواصل المفضلة', type: 'radio', required: true, options: ['هاتف', 'واتساب', 'حضوري'] },
      { key: 'preferredTime', label: 'الوقت المفضل', type: 'radio', required: true, options: ['صباحاً', 'ظهراً', 'مساءً'] },
      { key: 'summary', label: 'وصف مختصر للمشكلة', type: 'textarea', required: true },
    ],
  },
  {
    key: 'legal',
    label: 'استشارة قانونية',
    icon: 'scale',
    description: 'استشارات المساعدة القانونية',
    enabled: true,
    fields: [
      { key: 'name', label: 'الاسم الكامل', type: 'text', required: true },
      { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
      { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
      { key: 'governorate', label: 'المحافظة', type: 'governorate', required: true },
      { key: 'caseType', label: 'نوع القضية', type: 'radio', required: true, options: ['أحوال شخصية', 'قضية عمالية', 'أخرى'] },
      { key: 'summary', label: 'وصف القضية', type: 'textarea', required: true },
    ],
  },
  {
    key: 'family',
    label: 'استشارة أسرية',
    icon: 'users',
    description: 'استشارات شؤون الأسرة والتربية',
    enabled: true,
    fields: [
      { key: 'name', label: 'الاسم الكامل', type: 'text', required: true },
      { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true },
      { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
      { key: 'whatsapp', label: 'واتساب', type: 'whatsapp', required: false },
      { key: 'governorate', label: 'المحافظة', type: 'governorate', required: true },
      { key: 'preferredChannel', label: 'وسيلة التواصل المفضلة', type: 'radio', required: true, options: ['هاتف', 'واتساب', 'حضوري'] },
      { key: 'summary', label: 'وصف الموضوع', type: 'textarea', required: true },
    ],
  },
];

export async function seedCmsState(prisma: PrismaClient) {
  console.log('  Seeding CMS state...');

  await prisma.cmsState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      schemaVersion: 5,
      settingsJson: DEFAULT_SETTINGS,
      menuJson: DEFAULT_MENU,
      homeJson: DEFAULT_HOME,
      pagesJson: DEFAULT_PAGES,
      paymentMethodsJson: DEFAULT_PAYMENT_METHODS,
      consultationsJson: DEFAULT_CONSULTATION_TYPES,
    },
  });

  console.log('  ✓ CMS state (schema v5)');
}
