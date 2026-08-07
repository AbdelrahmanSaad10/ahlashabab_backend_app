// Booking statuses
export const BookingStatus = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
  NO_SHOW: 'لم يحضر',
} as const;

export type BookingStatusType = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BOOKING_TRANSITIONS: Record<string, string[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
};

// Donation statuses
export const DonationStatus = {
  PENDING_CONFIRMATION: 'قيد التأكيد',
  PENDING_REVIEW: 'قيد المراجعة',
  COMPLETED: 'مكتمل',
  FAILED: 'فشل',
} as const;

export type DonationStatusType = (typeof DonationStatus)[keyof typeof DonationStatus];

// Volunteer application statuses
export const VolunteerStatus = {
  NEW: 'جديد',
  CONTACTED: 'تم التواصل',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
} as const;

// Contact message statuses
export const ContactStatus = {
  NEW: 'جديد',
  REPLIED: 'تم الرد',
} as const;

// Consultation request statuses
export const ConsultationStatus = {
  NEW: 'جديد',
  UNDER_REVIEW: 'قيد المراجعة',
  SCHEDULED: 'تم تحديد موعد',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
} as const;

// Sponsorship statuses
export const SponsorshipStatus = {
  AVAILABLE: 'متاحة للكفالة',
  PARTIAL: 'مكفولة جزئياً',
  COMPLETE: 'مكتملة',
} as const;

// Donation methods
/**
 * Donation methods. Only BANK_TRANSFER (CIB / InstaPay), FAWRY and
 * VODAFONE_CASH are offered — all are completed outside the app and approved
 * by an admin. CARD and INSTAPAY are **legacy**: kept so historical rows and
 * report filters still resolve, but rejected by `CreateDonationSchema`.
 */
export const DonationMethod = {
  FAWRY: 'فوري',
  VODAFONE_CASH: 'فودافون كاش',
  BANK_TRANSFER: 'تحويل بنكي',
  /** @deprecated legacy — not accepted for new donations */
  CARD: 'بطاقة بنكية',
  /** @deprecated legacy — folded into BANK_TRANSFER (same CIB account) */
  INSTAPAY: 'إنستاباي',
} as const;

// Article categories
export const ArticleCategory = {
  NEWS: 'خبر',
  ACTIVITY: 'نشاط',
  ARTICLE: 'مقال',
  CARAVAN: 'قافلة',
} as const;

// Portfolio types
export const PortfolioType = {
  PROJECT: 'مشروع',
  CASE: 'حالة',
  CARAVAN: 'قافلة',
  PROGRAM: 'برنامج',
  TRIP: 'رحلة',
  ARTICLE: 'مقال',
} as const;

// Notification kinds
export const NotificationKind = {
  DONATION: 'donation',
  CASE: 'case',
  PROJECT: 'project',
  BOOKING: 'booking',
  SYSTEM: 'system',
} as const;

// Notification preference keys
export const NotificationPrefKey = {
  DONATIONS: 'donations',
  CASES: 'cases',
  PROJECTS: 'projects',
  BOOKINGS: 'bookings',
  NEWS: 'news',
  SYSTEM: 'system',
} as const;

// CMS valid tab names for NavTarget validation
export const VALID_TABS = [
  'Home',
  'Cases',
  'UrgentCases',
  'Donate',
  'Consultations',
  'About',
] as const;

// Legacy tab remaps
export const TAB_REMAPS: Record<string, string> = {
  Discover: 'ServicesBrowse',
  News: 'NewsFeed',
  Profile: 'AccountSettings',
};

// CMS Schema version
export const CMS_SCHEMA_VERSION = 10;
