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
  { id: 'بطاقة بنكية', group: 'دفع إلكتروني', description: 'فيزا / ماستركارد — تأكيد فوري من بوابة الدفع', availability: 'متاحة', manual: false },
  { id: 'فوري', group: 'دفع إلكتروني', description: 'ادفع بكود فوري من أقرب منفذ', availability: 'متاحة', manual: false },
  { id: 'إنستاباي', group: 'تحويل بنكي', description: 'حوِّل عبر إنستاباي — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
  { id: 'فودافون كاش', group: 'محفظة إلكترونية', description: 'الدفع عبر المحفظة الإلكترونية', availability: 'قيد التفعيل', manual: false },
  { id: 'تحويل بنكي', group: 'تحويل بنكي', description: 'تحويل على حساب الجمعية — يُعتمد بعد مراجعة الإدارة', availability: 'متاحة', manual: true },
];

const DEFAULT_CONSULTATION_TYPES = [
  {
    key: 'psychological',
    label: 'استشارة نفسية',
    icon: 'brain',
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
    key: 'legal',
    label: 'استشارة قانونية',
    icon: 'scale',
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
    key: 'family',
    label: 'استشارة أسرية',
    icon: 'users',
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
    key: 'social',
    label: 'استشارة اجتماعية',
    icon: 'home',
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
    key: 'educational',
    label: 'استشارة تعليمية',
    icon: 'book',
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

export async function seedCmsState(prisma: PrismaClient) {
  console.log('  Seeding CMS state...');

  await prisma.cmsState.upsert({
    where: { id: 1 },
    update: {
      schemaVersion: 10,
      settingsJson: DEFAULT_SETTINGS,
      menuJson: DEFAULT_MENU,
      homeJson: DEFAULT_HOME,
      pagesJson: DEFAULT_PAGES,
      paymentMethodsJson: DEFAULT_PAYMENT_METHODS,
      consultationsJson: DEFAULT_CONSULTATION_TYPES,
    },
    create: {
      id: 1,
      schemaVersion: 10,
      settingsJson: DEFAULT_SETTINGS,
      menuJson: DEFAULT_MENU,
      homeJson: DEFAULT_HOME,
      pagesJson: DEFAULT_PAGES,
      paymentMethodsJson: DEFAULT_PAYMENT_METHODS,
      consultationsJson: DEFAULT_CONSULTATION_TYPES,
    },
  });

  console.log('  ✓ CMS state (schema v10)');
}
