import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Documentation-only DTOs for the CMS surface.
 *
 * Validation in this codebase is done with Zod pipes, so these classes are not
 * used at runtime — they exist so `@nestjs/swagger` can emit real schemas
 * instead of the empty `200` responses the spec had before.
 *
 * Field names here are the wire contract, which is `CmsState` in the app's
 * `@ahla/shared` — not the Prisma column names. See BACKEND.md §18.2/§19.
 */

export class SocialsDto {
  @ApiProperty({ example: 'https://facebook.com/ahlashabab', description: 'Empty string hides the button in the app' })
  facebook!: string;

  @ApiProperty({ example: '' })
  instagram!: string;

  @ApiProperty({ example: '' })
  youtube!: string;

  @ApiProperty({ example: '' })
  twitter!: string;
}

export class FoundationStatsDto {
  @ApiProperty({ example: '12', description: 'Display string, not a count — rendered verbatim' })
  governorates!: string;

  @ApiProperty({ example: '1.2M+' })
  beneficiaries!: string;

  @ApiProperty({ example: '+12' })
  yearsOfService!: string;
}

export class CmsSettingsDto {
  @ApiProperty({ example: 'خواطر أحلى شباب' })
  appName!: string;

  @ApiProperty({ example: 'جمعية خواطر أحلى شباب' })
  heroTitle!: string;

  @ApiProperty()
  heroSubtitle!: string;

  @ApiProperty({ example: 'معاً نصنع أثراً يدوم' })
  splashText!: string;

  @ApiProperty({ example: '#18489F' })
  primaryColor!: string;

  @ApiProperty({ example: '#E9AF31' })
  secondaryColor!: string;

  @ApiProperty({ example: '19XXX', description: 'Renamed from contactPhone in schema v6' })
  hotline!: string;

  @ApiProperty({ example: 'info@ahlashabab.com', description: 'Renamed from contactEmail in schema v6' })
  email!: string;

  @ApiProperty({ description: 'Renamed from contactAddress in schema v6' })
  address!: string;

  @ApiProperty({ example: 'السبت — الخميس، 9ص — 5م' })
  workingHours!: string;

  @ApiProperty({ example: 'https://ahlashabab.com' })
  website!: string;

  @ApiProperty({ type: SocialsDto, description: 'Renamed from socialLinks in schema v6' })
  socials!: SocialsDto;

  @ApiProperty({ example: 357000, description: 'EGP value of 85g gold. Renamed from zakatNisab in schema v6' })
  zakatNisabEgp!: number;

  @ApiProperty({ description: 'Legal text shown on the donation screen' })
  donationReassurance!: string;

  @ApiProperty()
  demoLabel!: string;

  @ApiProperty({ type: FoundationStatsDto })
  stats!: FoundationStatsDto;
}

export const FORM_FIELD_TYPES = [
  'text', 'textarea', 'phone', 'whatsapp', 'email', 'number', 'age', 'governorate',
  'radio', 'checkbox', 'multiselect', 'date', 'time', 'file', 'info', 'consent',
] as const;

export class FormFieldDto {
  @ApiProperty({ example: 'name' })
  key!: string;

  @ApiProperty({
    enum: FORM_FIELD_TYPES,
    description: '`consent` renders a required checkbox — every consultation form ends with one',
  })
  type!: (typeof FORM_FIELD_TYPES)[number];

  @ApiProperty({ example: 'الاسم بالكامل' })
  label!: string;

  @ApiProperty({ default: false })
  required!: boolean;

  @ApiProperty({ default: false, description: 'Hidden fields are not rendered by the app' })
  hidden!: boolean;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiPropertyOptional({ type: [String], description: 'Required for radio / checkbox / multiselect' })
  options?: string[];

  @ApiPropertyOptional({ example: 'اكتب اسمك' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Arabic copy shown when validation fails; the app falls back to a generic message without it' })
  validationMessage?: string;

  @ApiPropertyOptional()
  help?: string;

  @ApiPropertyOptional({ description: 'Show this field only while values[showIfKey] === showIfValue' })
  showIfKey?: string;

  @ApiPropertyOptional()
  showIfValue?: string;
}

export class ConsultationTypeDto {
  @ApiProperty({ example: 'نفسية', description: 'Arabic key — also the app route param. URL-encode it on :key routes' })
  key!: string;

  @ApiProperty({ example: 'استشارة نفسية' })
  name!: string;

  @ApiProperty({ example: 'heart' })
  icon!: string;

  @ApiProperty({ example: 'جلسة سرية مع أخصائي نفسي معتمد.' })
  description!: string;

  @ApiProperty({
    example: 'هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.',
    description: 'Advisory text the app shows on every form. Do not omit on medical types.',
  })
  disclaimer!: string;

  @ApiProperty({ enum: ['published', 'draft'] })
  status!: 'published' | 'draft';

  @ApiProperty()
  visible!: boolean;

  @ApiProperty({ description: 'Surface this type on the app home screen' })
  homeVisible!: boolean;

  @ApiProperty({ type: [String], example: ['صباحاً (9-12)', 'أي وقت'] })
  availableTimes!: string[];

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ type: [FormFieldDto] })
  fields!: FormFieldDto[];
}

export class PaymentMethodDto {
  @ApiProperty({ example: 'إنستاباي' })
  id!: string;

  @ApiProperty({ enum: ['دفع إلكتروني', 'تحويل بنكي', 'محفظة إلكترونية'] })
  group!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: ['متاحة', 'قيد التفعيل', 'غير متاحة حالياً'] })
  availability!: string;

  @ApiProperty({
    description: 'true = donation waits on admin approval (قيد المراجعة); false = waits on the gateway callback (قيد التأكيد). The app never marks a donation successful itself.',
  })
  manual!: boolean;
}

export class MediaItemDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  alt?: string;

  @ApiPropertyOptional()
  caption?: string;

  @ApiPropertyOptional()
  folder?: string;

  @ApiProperty({ description: 'Mapped from the srcUrl column — the app reads `src`' })
  src!: string;

  @ApiProperty({ example: 'image' })
  type!: string;

  @ApiPropertyOptional()
  width?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiPropertyOptional()
  sizeBytes?: number;
}

export class CmsStateDto {
  @ApiProperty({ example: 6, description: 'Renamed from schemaVersion in schema v6' })
  version!: number;

  @ApiProperty({ type: CmsSettingsDto })
  settings!: CmsSettingsDto;

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'MenuGroup[] — sidebar groups and items with NavTarget' })
  menu!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'HomeSection[] — ordered, toggleable home sections' })
  home!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'CmsPage[] — published pages only on this endpoint' })
  pages!: Record<string, unknown>[];

  @ApiProperty({ type: [MediaItemDto], description: 'Resolved by getMediaSrc() against imageId/mediaId references' })
  media!: MediaItemDto[];

  @ApiProperty({ type: [PaymentMethodDto] })
  paymentMethods!: PaymentMethodDto[];

  @ApiProperty({ type: [ConsultationTypeDto], description: 'Renamed from consultationTypes in schema v6' })
  consultations!: ConsultationTypeDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'Always empty on this public endpoint — the audit log is admin-only (GET /admin/activity)',
  })
  activity!: Record<string, unknown>[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  updatedAt?: string | null;
}
