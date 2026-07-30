# Ahla Shabab — Backend Specification

Backend requirements for **جمعية خواطر أحلى شباب**, derived from the Technical Offer (§5–§8) and the already-built frontend (`mobile/` app + `dashboard/`). Every entity and endpoint below maps to a real screen or module that already consumes it via mock data in `@ahla/shared` — the job of the backend is to replace those mocks with a real REST API + database, changing nothing about the UI contracts.

> Status: **not started** (deferred). This document is the source of truth for what to build. The frontend is a demo on `@ahla/shared` mock data (app **v1.4.0**).
>
> **Updated 2026-07-05** to cover the newer mobile screens: in-app Notifications + preferences, News/Articles feed, Volunteer applications, Contact-us messages, My Bookings, Donation history/receipts, Account settings, Zakat calculator (nisab config), FAQ, Onboarding. Sections marked **(v1.1)** are those additions.
>
> **Updated 2026-07-13 (v1.2)** for the UX-review pass: **passwordless email login** (replaces phone/OTP — see §5), the multi-step **donation wizard**, **اكفل أسرة** (monthly sponsorship) + **حالات عاجلة** (urgent cases) with sponsorship fields on `cases`, **per-type consultation request forms** (new `consultation_requests` inbox), the notification center, `workGovernorates` replacing the "22 محافظة" claim, and `appConfig`-driven app settings. Sections marked **(v1.2)** are those additions.
>
> **Updated 2026-07-19 (v1.3)** for the CMS layer shipped in v1.3.0: a **headless CMS** that controls the app's sidebar menu, Home page layout, generic CMS pages, **consultation type configuration + dynamic form builder**, and a **media library**. The demo persists everything to browser localStorage; the backend must replace localStorage with a real persistence layer. Sections marked **(v1.3)** are those additions.
>
> **Updated 2026-07-27 (v1.4)** after the QA acceptance pass and fix rounds. CMS schema moved **3 → 5** (impact numbers and payment methods became CMS-owned), the consultation **email is now required and is the identity key**, and the provider portal gained **working-hours** and **reschedule** operations. It also documents, in §17, exactly which demo state is **in-memory only** — that is the list of things the backend must own, and it is the single biggest gap between the demo and a working product. Sections marked **(v1.4)** are those additions.

---

## 1. Scope & goals

A single backend that serves **two clients**:

1. **Mobile app** (React Native / Expo) — beneficiaries & donors. Mostly reads (portfolio, services catalog, providers, articles), plus writes: **service bookings** (guest or account), **donations**, **volunteer applications**, **contact messages**, profile edits, and notification preferences.
2. **Admin dashboard** (React) — foundation staff. Full CRUD + booking operations + reports, gated by **roles & permissions**.

Non-goals for v1: real payment-gateway settlement (integrate provider sandboxes only), analytics beyond the dashboard's reports, multi-language content (Arabic only for now).

---

## 2. Architecture (three-tier, per Offer §6.1)

```
┌─────────────┐     HTTPS/JWT      ┌──────────────┐      ┌─────────────┐
│  Mobile app │ ─────────────────▶ │  Backend API │ ───▶ │  PostgreSQL │
│  Dashboard  │ ◀───────────────── │  (REST)      │      │  + media FS │
└─────────────┘                    └──────┬───────┘      └─────────────┘
                                          │
                                          ▼
                              FCM (push) · Email (OTP)
```

- **Presentation:** mobile app + dashboard (built).
- **Application:** REST API — business logic, validation, auth, booking engine.
- **Data:** PostgreSQL (relational, referential integrity) + local filesystem for media.

---

## 3. Tech stack

The Offer allows **Laravel (PHP)** or **Node/Express**. Recommendation: **Node.js + Express + TypeScript + PostgreSQL** so the whole repo stays one language and can share `@ahla/shared` types.

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node 20 + TypeScript | Reuse `@ahla/shared` domain types |
| Framework | Express (or Fastify/NestJS) | REST |
| DB | PostgreSQL 15 | Prisma or Drizzle ORM for typed queries + migrations |
| Auth | JWT (access + refresh) | `bcrypt`/`argon2` for password hashing |
| Validation | zod | Validate every request body/query |
| Files | Local filesystem (`/uploads`) | Served behind the API; S3-compatible later |
| Push | Firebase Cloud Messaging | Booking status + reminders |
| Email/OTP | Pluggable provider (SES / SendGrid / SMTP) | Passwordless user login + transactional email |
| SMS | Pluggable provider (e.g. Twilio / local aggregator) | Optional — guest-booking verification |
| Jobs | node-cron / BullMQ | Reminders, slot cleanup |

New workspace: `backend/` alongside `mobile/`, `dashboard/`, `shared/`.

---

## 4. Environments & configuration (env vars)

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://user:pass@host:5432/ahla_shabab
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
UPLOAD_DIR=/var/app/uploads
PUBLIC_BASE_URL=https://api.ahlashabab.com
FCM_SERVER_KEY=...
EMAIL_PROVIDER=ses            # ses | sendgrid | smtp — powers passwordless login
EMAIL_FROM=no-reply@ahlashabab.com
EMAIL_PROVIDER_KEY=...
OTP_TTL=10m                   # email verification code lifetime
SMS_PROVIDER_KEY=...          # optional (guest-booking verification)
SMS_ENABLED=false             # feature flag
CORS_ORIGINS=https://dashboard.ahlashabab.com
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100
```

Per Offer pricing note: hosting, domains, gateway/SMS/FCM accounts are the foundation's responsibility — the code must read all such credentials from env, never hard-code them.

---

## 5. Authentication & authorization

### 5.1 Actors
- **Guest** — browses everything and books a service with just a contact phone number (Offer §4.4). No account.
- **Registered user** — account keyed on **email** (passwordless), tracks donations/receipts, booking history, favorites, notifications, reminders. Phone is optional contact info, not the login identity.
- **Admin** — dashboard user with a role.

### 5.2 Mechanism
- **User login is passwordless email OTP** (matches the mobile app since v1.2.1): `EmailAuthScreen` collects the email → `POST /auth/otp/request` emails a 6-digit code → `OtpScreen` submits it → `POST /auth/otp/verify` returns JWT access + refresh tokens. No password is stored for end users.
- **JWT** access + refresh tokens. Access token in `Authorization: Bearer`. Refresh rotation on `/auth/refresh`.
- Admin accounts keep email + password (hashed with **argon2/bcrypt**) — separate from the passwordless end-user flow.
- The email-OTP provider is pluggable (SES / SendGrid / SMTP); an optional SMS channel can back guest-booking verification via the same request/verify endpoints.

### 5.3 Roles & permissions (Offer §5-F) — matches dashboard `adminRoles`
Roles: `مدير عام` (Super Admin), `مدير محتوى` (Content Manager), `مدير حجوزات` (Bookings Manager), `اطّلاع فقط` (Read-Only).

Permission modules (boolean per role): `portfolio, services, providers, bookings, users, reports, roles`.

- Enforce with middleware: `requirePermission('bookings', 'write')`.
- Every mutating admin action writes an **activity log** entry (actor, action, target, timestamp).

---

## 6. Data model

Entities mirror `@ahla/shared` (`types.ts`, `services.ts`, `admin.ts`, `cms/cmsTypes.ts`). Suggested tables:

### Catalog & providers
- **service_categories** — `id, name, icon, description, parent_id (self-FK, nullable → unlimited nesting), active, sort_order`
- **providers** — `id, name, specialization, bio, years_experience, rating, reviews, avatar_url, active`
- **provider_schedules** — `id, provider_id, weekday (0–6), start_time, end_time, slot_minutes` (weekly template)
- **provider_unavailable_dates** — `id, provider_id, date` (holidays/vacation)
- **services** — `id, name, description, category_id (FK), provider_id (FK), free, require_national_id, active`
- **service_form_fields** — per-service overrides of the booking form (`key, label, type, required, hidden, options_json`) so admins can configure required/optional/custom fields (Offer §4.3)

### Bookings & users
- **users** — `id, name, email (unique — login identity), phone (nullable contact), governorate, is_guest, blocked, created_at` (passwordless; no `password_hash` for end users)
- **bookings** — `id, reference (unique, e.g. AS-482910), service_id, provider_id, user_id (nullable), applicant_name, phone, age, gender, governorate, city, national_id, notes, date, time_slot, status, created_at`
  - `status ∈ {قيد الانتظار, مؤكد, مكتمل, ملغي, لم يحضر}` (Pending/Confirmed/Completed/Cancelled/No-Show)
- **favorites** — `id, user_id, entity_type (project|case|service), entity_id`

### Portfolio / CMS (Offer §5-A) — `portfolioItems`
- **portfolio_items** — `id, type (مشروع|حالة|قافلة|برنامج|رحلة|مقال), title, description, governorate, date, published, cover_url, body, metadata_json`
- **cases** — `id, code, title, location, summary, need, tag, verified, target_amount, raised_amount, supporters, cover_url` + sponsorship fields (`sponsorable, monthly_amount, sponsorship_duration, sponsorship_status ∈ {متاحة للكفالة, مكفولة جزئياً, مكتملة}`) powering the **اكفل أسرة** (Sponsorship) + **حالات عاجلة** (UrgentCases) screens; (+ `case_updates`: `id, case_id, text, kind, created_at` for "آخر التحديثات")
- **projects** — `id, title, description, status, category, timeline, target_amount, raised_amount, supporters, cover_url` (+ `project_stages`: `id, project_id, label, done, sort_order`, and `project_updates` timeline)
- **work_areas** — governorates where the foundation operates (feeds Home + About "مناطق عمل الجمعية" chips; seed from `workGovernorates`). Replaces the former unverified "22 محافظة" numeric claim.
- **foundation_stats / milestones / values / initiatives** — small content tables (beneficiaries, years of service, timeline entries) feeding the mobile Home + About screens
- **consultants** — advisory profiles for the Consultations screen

### Donations (mobile checkout)
- **donations** — `id, reference (AS-######), donor_name, user_id (nullable), cause, amount, method, recurring, status, created_at`
  - `method ∈ {بطاقة بنكية, فوري, إنستاباي, فودافون كاش, تحويل بنكي}`
  - `reference` shown on the mobile receipt (DonationSuccess) and in donation history.

### Engagement & content **(v1.1)**
- **articles** — news/activities feed: `id, category (خبر|نشاط|مقال|قافلة), title, excerpt, body, date, location, read_minutes, cover_url, published` (mobile NewsFeed/ArticleDetail; managed from dashboard Content)
- **volunteer_applications** — `id, name, phone, age, governorate, interests_json, availability, status (جديد|تم التواصل|مقبول|مرفوض), created_at` (mobile Volunteer form)
- **contact_messages** — `id, name, phone, message, status (جديد|تم الرد), created_at` (mobile ContactUs form)
- **consultation_requests** — per-type consultation forms (mobile Consultations → ConsultationRequest): `id, reference (AS-######), user_id (nullable), type (key from cms consultation types), name, phone, whatsapp, email, age, governorate, preferred_channel, preferred_time, summary, extra_fields_json (type-specific answers keyed by FormField.key), status (جديد|قيد المراجعة|تم تحديد موعد|مكتمل|ملغي), created_at`. The backend receives them and surfaces them in a dashboard inbox for the consultations team.
  - **(v1.4) `email` is required and is the identity key.** It was optional until the QA pass, which is what let anonymous submissions collapse together (D-09). The whole "returning guest" feature depends on it: a guest submits without an account, and later signs in with the same address to find their history waiting.
  - **Match on a normalised email** — `trim().toLowerCase()` — not on the raw string. `Test@Example.COM`, `test@example.com` and `"  test@example.com  "` must all resolve to **one** user. The demo implements this in `mobile/src/store/demoUsers.ts` (`normalizeEmail`, `findOrCreateDemoUserByEmail`, `attachConsultationToDemoUser`, `loginDemoUserByEmail`); the backend should own the same four behaviours and enforce uniqueness on the normalised column.
  - **Find-or-create on submit, link on login.** A request from an unknown email creates a lightweight user (no password — login is passwordless anyway) and attaches to it. On OTP login, every prior request for that email becomes visible, and **no duplicate user is created**.
  - **Never fall back to a shared address.** The demo briefly used a single `guest@ahlashabab.com` for emailless submissions, which merged unrelated people into one identity. If a CMS form config makes `email` optional again, generate a **per-submission** key instead; never a constant.
- **notifications** — per-user in-app feed: `id, user_id, kind (donation|case|project|booking|system), title, body, read, created_at` (mobile Notifications screen; most rows generated by backend events — booking status changes, donation receipts, case/project updates)
- **notification_preferences** — `user_id, key (donations|cases|projects|bookings|news|system), enabled` (mobile NotificationPreferences; must be respected before any push/in-app fan-out)
- **device_tokens** — `id, user_id, token, platform, updated_at` (FCM)
- **faqs** — `id, question, answer, sort_order, published` (mobile FAQ; editable from dashboard)
- **app_config** — key/value store: `zakat_nisab` (EGP value of 85g gold, powers the Zakat calculator default), hotline, email, address, working hours, social links (mobile ContactUs + ZakatCalculator read these).
  - **(v1.4) These now live in `cms_state.settings_json`,** not a separate store — the dashboard's *إعدادات التطبيق* writes them there and the app reads them from the same place. Keep one source of truth; if you prefer a dedicated `app_config` table, have the CMS read through to it rather than duplicating.
  - **Social links must be per-network and may be blank.** The app hides any network whose URL is empty or identical to the website, because a "Facebook" button that reopens the website is a dead button (D-12). Return them individually; do not default them all to the website URL.

### Headless CMS **(v1.3)**

The CMS controls **app structure** (not entity content). In v1.3.0 it is a localStorage demo; the backend must persist and serve a single `CmsState` blob per tenant.

- **cms_state** — `id, schema_version (int), settings_json, menu_json, home_json, pages_json, consultations_json, updated_at` — a single-row table (or key/value store) holding the serialized `CmsState` from `shared/src/cms/cmsTypes.ts`. The dashboard's `cmsStore` writes this; the mobile app reads it on launch.
  - `settings_json` → `CmsSettings`: app name, colors, hero text, contact info, social links, zakat nisab, demo label, and **(v1.4)** `stats` — the About-screen impact figures (`governorates`, `beneficiaries`, `yearsOfService`), all stored as **strings** because they are display values like `"1.2M+"`, not counts. These are editable from the dashboard and read by the app; do **not** derive them from row counts unless the foundation asks for that.
  - `menu_json` → `MenuGroup[]`: sidebar navigation groups + items with `NavTarget` (tab / route / cmsPage / external). Replaces `AppDrawer` hardcoding.
  - `home_json` → `HomeSection[]`: ordered, toggleable home sections (`hero`, `impactStats`, `workAreas`, `quickServices`, `urgentCases`, `sponsorship`, `featuredProjects`, `latestNews`, `consultations`, `donationCta`, `volunteerCta`, `contactCta`, `imageBanner`, `textBlock`, `faqPreview`, `spacer`). Each section has `config` knobs (itemCount, layout, ctaText/Target, entityIds, imageId, background, body).
  - `pages_json` → `CmsPage[]`: generic pages with `PageSection[]` + `ContentBlock[]` (rich block content: `heading`, `paragraph`, `bulletList`, `orderedList`, `quote`, `highlight`, `image`, `cta`, `contact`, `divider`). Native RN screens are referenced with `builtin: true` and do not render sections.
  - `payment_methods_json` → `PaymentMethodInfo[]` **(v1.4)**: the donation methods shown on the app's Donate step 4 — `id, group, description, availability (متاحة|قيد التفعيل|غير متاحة حالياً), manual`. `manual: true` means the donation stays **قيد المراجعة** until an admin approves it; `false` means it stays **قيد التأكيد** until the payment gateway confirms. **The app must never mark a donation successful on its own** — see §11.
  - `consultations_json` → `ConsultationTypeConfig[]`: per-type consultation config including the **dynamic form schema** (`FormField[]` — field types: `text`, `textarea`, `phone`, `whatsapp`, `email`, `number`, `age`, `governorate`, `radio`, `checkbox`, `multiselect`, `date`, `time`, `file`, `info`, `consent`). The mobile `ConsultationRequestScreen` renders these fields; the dashboard `CmsForms` page edits them.

- **cms_media** — `id, title, alt, caption, folder, src_url, type (image|svg), width, height, size_bytes, created_at, updated_at` — separates the media library from the core CMS state (mirrors `MediaItem` in `cmsTypes.ts`). Uploaded via `POST /admin/cms/media`; referenced by `mediaId` / `imageId` fields throughout the CMS.

> **Schema versioning:** `CMS_SCHEMA_VERSION` (currently **`5`**) must be stored and a migration path provided when the shape changes — the backend must run `migrate(parsed)` before persisting an imported blob. Migrations shipped so far, all backfill-on-read and safe to re-run:
> - **1 → 2** seed the media library · **2 → 3** seed consultation types
> - **3 → 4** seed `settings.stats` from `foundationStats`
> - **4 → 5** seed `paymentMethods` from the shared defaults
>
> **`NavTarget` of kind `tab` must be validated server-side** against the real tab set — `Home | Cases | UrgentCases | Donate | Consultations | About`. A menu item naming a tab that does not exist is silently ignored by React Navigation and renders as a **dead button** with no error. That is exactly how three dead menu items shipped (QA D-01); the frontend now has a compile-time guard plus a legacy remap (`Discover→ServicesBrowse`, `News→NewsFeed`, `Profile→AccountSettings`), and the API should reject or remap unknown tabs rather than storing them.

### Admin & audit
- **admin_users** — `id, name, email, password_hash, role_id, active`
- **roles** — `id, name, description, permissions_json`
- **activity_log** — `id, actor_id, action, target, created_at`

### Reference
- **governorates** — the 27 Egyptian governorates (seed from `shared/services.ts`).

---

## 7. Public API (mobile app)

Base: `/api/v1`. All list endpoints support `?page=&limit=&q=`. Read endpoints are public; booking/donation writes accept guest or bearer token.

### Portfolio / content
| Method | Path | Purpose |
|---|---|---|
| GET | `/home` | Aggregated home payload: hero, foundationStats, quickServices, urgent case, featured project |
| GET | `/foundation` | About: stats, mission/vision, values, initiatives, milestones, impact |
| GET | `/projects` · `/projects/:id` | Projects list + detail (with stages) |
| GET | `/cases` · `/cases/:id` | Cases list (filter `?tag=`) + detail (with updates) |
| GET | `/consultants` | Consultations hub |
| GET | `/articles?category=` · `/articles/:id` | **(v1.1)** News/activities feed + article detail |
| GET | `/faqs` | **(v1.1)** Published FAQ entries |
| GET | `/config` | **(v1.1)** App config: zakat nisab, hotline/email/address, social links |

### Services catalog & booking (Offer §4)
| Method | Path | Purpose |
|---|---|---|
| GET | `/categories?parentId=` | Child categories (null = main). Unlimited nesting |
| GET | `/categories/:id/services` | Bookable services in a (sub)category |
| GET | `/services/:id` | Service + provider detail |
| GET | `/providers` · `/providers/:id` | Providers directory + profile (with their services) |
| GET | `/services/:id/availability?from=&to=` | **Available days + open slots** for the service's provider (schedule minus unavailable dates minus already-booked). Drives the calendar |
| GET | `/services/:id/form` | Effective booking-form field schema for this service |
| POST | `/bookings` | Create a booking (guest: phone only; or bearer). Returns `{ reference, status: 'قيد الانتظار', ... }` |
| GET | `/bookings/:reference` | Booking confirmation lookup |

### Donations
| Method | Path | Purpose |
|---|---|---|
| POST | `/donations` | Create a donation (cause, amount, method, recurring). Returns `{ reference, status }` — the reference is shown on the receipt screen |

### Engagement **(v1.1)**
| Method | Path | Purpose |
|---|---|---|
| POST | `/volunteers` | Submit a volunteer application (name*, phone*, age, governorate*, interests*[], availability) |
| POST | `/contact` | Submit a contact-us message (name*, phone*, message*) |
| POST | `/consultations` | Submit a consultation request (type*, name*, phone*, whatsapp, email, age, governorate*, preferred_channel*, preferred_time*, summary*, extra_fields) — returns `{ reference, status: 'جديد' }` |
All three are guest-friendly (no auth), rate-limited, and land in dashboard inboxes.

### Auth & account
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/request` · `/auth/otp/verify` | **Passwordless email OTP** — request emails a 6-digit code to the address, verify returns JWT access + refresh (mobile EmailAuth → Otp) |
| POST | `/auth/refresh` · `/auth/logout` | Rotate / revoke tokens |
| POST | `/admin/auth/login` | Admin email + password login (dashboard only) |
| GET | `/me` · `/me/bookings` · `/me/donations` · `/me/favorites` · `/me/consultations` | Profile data (MyBookings tabs upcoming/past; DonationHistory with totals; consultation requests) |
| PATCH | `/me` | **(v1.1)** Update profile: name, phone, governorate, bio (AccountSettings). Email is the login identity — change requires re-verification |
| POST/DELETE | `/me/favorites` | Add/remove favorite |
| GET | `/me/notifications` | **(v1.1)** In-app notification feed (paginated, unread count) |
| PATCH | `/me/notifications/:id/read` · POST `/me/notifications/read-all` | **(v1.1)** Mark read / mark all read |
| GET/PUT | `/me/notification-preferences` | **(v1.1)** Per-type toggles (donations, cases, projects, bookings, news, system) |
| POST | `/me/device-tokens` | **(v1.1)** Register/refresh the FCM token |

---

## 8. Admin API (dashboard)

Base: `/api/v1/admin` — all require a valid admin JWT + the relevant permission.

### Bookings (Offer §5-D)
| Method | Path | Purpose |
|---|---|---|
| GET | `/bookings` | List with filters: `status, categoryId, providerId, governorate, date, q` |
| PATCH | `/bookings/:id/status` | Transition: confirm / reschedule / cancel / complete / no-show (notifies user) |
| PATCH | `/bookings/:id` | Reschedule (date/time), edit fields |
| GET | `/bookings/calendar?providerId=` | Per-provider upcoming appointments |
| GET | `/bookings/export?format=csv\|xlsx` | Export current filter |

### Services & categories (§5-B)
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/categories` | Nested category CRUD |
| PATCH | `/categories/:id/active` | Activate / deactivate (keeps data) |
| GET/POST/PATCH/DELETE | `/services` | Service CRUD + per-service form config |

### Providers (§5-C)
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/providers` | Provider CRUD (profile, bio, avatar) |
| PUT | `/providers/:id/schedule` | Weekly working days + slot duration + **(v1.4)** `start_time` / `end_time` (the working-day range) |
| POST/DELETE | `/providers/:id/unavailable` | Block/open specific dates |
| POST | `/providers/:id/services` | Assign/unassign services |
| PATCH | `/providers/:id/availability` | **(v1.4)** Toggle "accepting bookings" on/off |

**(v1.4) Provider self-service.** The mobile **لوحة مقدم الاستشارة** screen drives all of the above for the signed-in provider, so mirror them under `/me/provider/*` with the provider's own identity rather than an admin's. It also needs booking operations — see the next table.

| Method | Path | Purpose |
|---|---|---|
| GET | `/me/provider/bookings` | Own bookings, filterable by status + free-text search (name, email, phone, reference, governorate) |
| PATCH | `/me/provider/bookings/:id/status` | Confirm / complete / cancel |
| PATCH | `/me/provider/bookings/:id/schedule` | **Reschedule** — new date + time. **Must not change `status`**: moving a pending request is not the same as confirming it, and silently confirming would misrepresent the provider's intent |
| GET | `/me/provider/overview` | Counters: upcoming, today, new, completed, cancelled — derived server-side so they cannot drift from the list |

### Portfolio content (§5-A)
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/portfolio` | CRUD for projects, cases, caravans, programs, trips, articles, stats |
| PATCH | `/portfolio/:id/publish` | Publish / unpublish |
| POST | `/uploads` | Media upload (returns URL) |

### Users (§5-E)
| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | List/filter (phone, name, governorate, registered/guest) |
| GET | `/users/:id/bookings` | Booking history |
| PATCH | `/users/:id/block` | Block / unblock |
| GET | `/users/export` | CSV export |

### Roles & audit (§5-F) and Reports (§5-G)
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH | `/roles` | Roles + permission matrix |
| GET | `/activity` | Activity log |
| GET | `/reports/bookings?groupBy=category\|provider\|governorate\|status&from=&to=` | Aggregates for charts |
| GET | `/reports/utilization` | Completion rate, no-shows, avg per provider |
| GET | `/reports/export?type=...&format=pdf\|xlsx` | Downloadable reports |

### Engagement & content management **(v1.1)** — new dashboard modules
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/articles` | News/activities CRUD + publish toggle (feeds mobile NewsFeed) |
| GET | `/volunteers` | Volunteer applications inbox — filter by status/governorate/interest |
| PATCH | `/volunteers/:id/status` | جديد → تم التواصل → مقبول/مرفوض |
| GET | `/volunteers/export` | CSV export |
| GET | `/messages` | Contact-us inbox |
| PATCH | `/messages/:id` | Mark replied / add internal note |
| GET/POST/PATCH/DELETE | `/faqs` | FAQ CRUD + ordering |
| PUT | `/config` | Edit app config (zakat nisab, contact info, social links) |
| POST | `/notifications/broadcast` | Compose a push/in-app announcement to a segment (all, governorate, donors, …) — respects user preferences |

These imply two new sidebar modules in the dashboard (Volunteers inbox, Messages inbox) plus Articles/FAQ tabs inside Content — gate them under the existing `portfolio` (articles/faqs/config) and `users` (volunteers/messages) permission keys, or add dedicated keys if finer control is wanted.

### Headless CMS **(v1.3)** — new dashboard CMS module

The dashboard ships six new CMS sub-pages (Home Builder, Menu Manager, Pages, Forms, Media Library, Tools). All state is currently demo-only in localStorage; these endpoints replace that layer.

| Method | Path | Purpose |
|---|---|---|
| GET | `/cms` | Full `CmsState` snapshot (public — mobile reads on launch) |
| PUT | `/admin/cms` | Replace full `CmsState` (import JSON / bulk save from dashboard) |
| PATCH | `/admin/cms/settings` | Edit `CmsSettings` (app name, colors, hero, contact info, zakat nisab) |
| PUT | `/admin/cms/menu` | Replace menu `MenuGroup[]` (sidebar manager) |
| PUT | `/admin/cms/home` | Replace home `HomeSection[]` (home builder) |
| GET/POST/PATCH/DELETE | `/admin/cms/pages` | CMS page CRUD (`CmsPage` — template, sections, rich `ContentBlock[]` content) |
| PATCH | `/admin/cms/pages/:id/status` | Publish / draft toggle |
| GET/POST/PATCH/DELETE | `/admin/cms/consultations` | Consultation type config CRUD — including the `FormField[]` dynamic form schema (form builder) |
| GET | `/admin/cms/media` | List media library items |
| POST | `/admin/cms/media` | Upload image (server compresses + stores; returns `MediaItem`) |
| DELETE | `/admin/cms/media/:id` | Delete media item (fails if still referenced) |
| GET | `/admin/cms/export` | Download full `CmsState` as JSON (Tools → Export) |
| POST | `/admin/cms/import` | Upload + validate + migrate a JSON blob (Tools → Import; runs `cmsMigrations` if `schema_version` is older) |
| POST | `/admin/cms/backup` | Create server-side snapshot before a destructive import |

**Schema versioning:** The backend must store `schema_version` alongside the state and run `migrate(blob)` on import. Mobile clients must be able to handle `schema_version` ≤ current gracefully.

**Permission gating:** Gate `/admin/cms/*` under a new `cms` permission key (or reuse `portfolio` for settings/pages/media and `roles` for form schemas — to be decided in §15 open decisions).

---

## 9. Booking engine rules (the hard part)

1. **Slot generation** — from each provider's weekly `provider_schedules` (start/end + `slot_minutes`), generate concrete slots for a requested date range, **excluding** `provider_unavailable_dates` and any slot already taken by a non-cancelled booking.
2. **Availability endpoint** returns only future, open slots; the mobile calendar greys out full/unavailable days.
3. **Conflict detection** — creating/rescheduling a booking must be **transactional** with a uniqueness guard on `(provider_id, date, time_slot)` for active statuses, to prevent double-booking under concurrency (Offer §11 load-tests this).
4. **Reference generation** — unique human code `AS-######`.
5. **Status machine** — `Pending → Confirmed → Completed`, with `Cancelled`/`No-Show` as terminal side states; each transition may fire a notification.
6. **Form validation** — validate the submitted booking against the service's effective `service_form_fields` (required/optional/hidden, phone format, gender enum, governorate in the 27-list).
7. **Guest vs account** — guest bookings key off phone; if a matching user exists, link them.

---

## 10. Notifications
- **Two channels, one pipeline (v1.1):** every notable event writes an **in-app notification row** (feeds the mobile Notifications screen + bell unread badge) *and* optionally sends **FCM push** — both filtered through the user's `notification_preferences` before fan-out.
- Event triggers: booking received/confirmed/rescheduled/cancelled; reminder N hours before appointment (cron); donation receipt + monthly-sponsorship renewal; case reaching coverage milestones; project stage changes; admin broadcasts.
- **SMS/OTP** (optional): verification + optional booking confirmation text.
- Store device tokens per user (`POST /me/device-tokens`); no-op gracefully when a channel isn't configured.

---

## 11. Security (Offer §8)
- HTTPS/TLS everywhere; HSTS.
- Argon2/bcrypt password hashing; JWT with expiry + refresh rotation.
- **RBAC** on every admin route.
- Input validation + sanitization on **every** endpoint (zod) → prevents SQLi/XSS; use parameterized queries/ORM.
- CSRF protection for any cookie-based flows; prefer bearer tokens.
- **Rate-limiting** on `login`, `otp`, `bookings` (abuse/no-show protection).
- Activity log retained for accountability.
- CORS locked to known dashboard/app origins.
- Never log secrets or full national IDs.

---

## 12. Conventions
- **Errors**: `{ "error": { "code": "VALIDATION", "message": "...", "fields": {...} } }`, correct HTTP status codes.
- **Pagination**: `{ data: [...], page, limit, total }`.
- **Dates**: ISO `YYYY-MM-DD`; times as stored Arabic slot labels + a normalized 24h field.
- **Money**: integer EGP (piastres optional); currency label handled client-side.
- **i18n**: content Arabic; API keys/enums in Arabic where the UI already uses them (statuses, methods) to match `@ahla/shared`.

---

## 13. Seed data
Seed the DB directly from the existing mocks in `@ahla/shared` so the apps look identical on day one:
`serviceCategories, providers, services, governorates, bookingFormSchema, adminBookings, adminUsers, adminRoles, permissionModules, activityLog, portfolioItems, cases (incl. sponsorship fields), projects (incl. category/timeline), consultants, donations, foundationStats`, **(v1.1)** `articles, notifications, volunteerApplications, contactMessages`, **(v1.2)** `appConfig` (contact/hero/socials/zakat nisab) and `workGovernorates` (مناطق عمل الجمعية) — plus seed `faqs` from `mobile/src/screens/FaqScreen.tsx` and default `notification_preferences` from `NotificationPreferencesScreen.tsx`. Consultation requests start empty (submitted from the app). `app_config` now comes from `shared/appConfig` rather than being hard-coded in screens.

**(v1.3)** Seed `cms_state` from `shared/src/cms/cmsDefaults.ts` → `makeDefaultCmsState()`: this gives the correct default menu (`defaultMenu`), home sections (`defaultHome`), pages (`defaultPages`), consultation type configs with their dynamic `FormField[]` schemas (`defaultConsultationTypes`), and settings seeded from `appConfig`. Seed `cms_media` as empty (no bundled media in the demo). The `CMS_SCHEMA_VERSION` at seed time is `3`.

---

## 14. Build order (milestones)
1. **Scaffold** `backend/` + DB schema + migrations + seed from `@ahla/shared`.
2. **Auth**: admin email+password login; passwordless **email-OTP** user login + JWT + RBAC middleware; guest booking path.
3. **Catalog read APIs** → point mobile ServicesBrowse/ProviderDetail/ServiceDetail at them.
4. **Booking engine**: availability + create booking + confirmation → wire mobile BookAppointment.
5. **Dashboard admin APIs**: bookings ops, categories/services, providers/schedules → replace dashboard in-session state.
6. **Portfolio CMS + Users + Roles/Activity** — including **(v1.1)** articles, FAQs, and app-config.
7. **Engagement (v1.1+)**: volunteer applications + contact messages + consultation requests (public POST + dashboard inboxes), `PATCH /me`, notification preferences.
8. **Reports/analytics + exports**.
9. **Notifications**: in-app feed + FCM + reminders cron + admin broadcast **(v1.1: preference-filtered pipeline)**.
10. **Donations** endpoints (+ gateway sandbox), receipts by reference.
11. **(v1.3) Headless CMS**: `GET /cms` (public snapshot) + full `/admin/cms/*` suite — settings, menu, home, pages (with rich `ContentBlock[]`), consultation types + dynamic `FormField[]` schemas, media library (upload/delete), and Tools (export/import with migration). Seed `cms_state` from `makeDefaultCmsState()`. Wire mobile `cms.ts` store to fetch from `/cms` instead of falling back to `makeDefaultCmsState()`.
12. **Hardening**: rate limits (now also on `/volunteers`, `/contact`, `/consultations`, `/auth/otp/*`, `/cms` write paths), load test the booking endpoint (Offer §11), OWASP pass.

---

## 15. Open decisions (need input)
- **Stack**: confirm Node/Express (recommended) vs Laravel.
- **ORM/migrations**: Prisma vs Drizzle.
- **OTP provider** and whether OTP ships in v1.
- **Payment gateways**: which of Fawry / InstaPay / Vodafone Cash / card go live vs sandbox first.
- **Hosting/DB**: managed Postgres? where is media stored long-term (local vs S3)?
- **Auth for donors**: required accounts or fully guest-first?
- **(v1.3) CMS persistence strategy**: single-row `cms_state` table (simple, atomic) vs normalized tables per entity type (more queryable). Single-row is strongly recommended given the CMS is edited as a unit and queried as a snapshot.
- **(v1.3) CMS media storage**: store processed images in the same `UPLOAD_DIR` as booking/case media, or a separate CDN bucket? Max resolution/quality settings (current dashboard compresses client-side to ~80% JPEG ≤1280px).
- **(v1.3) CMS permission key**: add a dedicated `cms` permission module, or reuse `portfolio` for structural config? Finer-grained control (e.g. separate `cms.forms` for the consultation form builder) may be warranted.
- **(v1.4) Consultation → booking flow**: when a `consultation_request` is accepted, does it become a `booking` against a provider (one pipeline), or stay a parallel inbox the team works manually? The demo has them as two unconnected stores, which is the most visible missing link — see §17.
- **(v1.4) Provider identity**: are providers `admin_users` with a restricted role, or a separate `providers` login? The mobile provider dashboard assumes a signed-in provider can read and mutate **only their own** bookings and schedule, which needs whichever model you pick to carry an ownership check.
- **(v1.4) Impact figures**: confirm the real numbers (or agree to drop the block). They are CMS-editable now, so this is a content decision, not a code change.

---

## 16. Security acceptance criteria (production sign-off — added by QA pass v2)

These MUST be implemented and tested server-side before launch. The mobile app already enforces the client half (statuses `قيد التأكيد`/`قيد المراجعة` only — see `shared/src/rules.ts` + unit tests in `shared/src/__tests__/rules.test.ts`).

**Donations**
1. `POST /donations` accepts NO `status` field from clients — the server sets it (`قيد التأكيد` gateway / `قيد المراجعة` manual). Reject any payload containing `status`.
2. Only two paths may set `مكتمل`: (a) the payment-gateway webhook after signature verification; (b) `PATCH /admin/donations/:id/status` by an admin holding the `donations` permission.
3. Webhooks are **idempotent**: store the gateway transaction id with a unique constraint; replays return 200 without state change; out-of-order events cannot regress a final state.
4. Amount + destination are re-validated server-side against the gateway's charged amount — mismatch → flag `قيد المراجعة`, never auto-complete.
5. Receipts: `GET /me/donations/:ref` returns only the requester's own receipts (401/403 otherwise); receipts contain no beneficiary personal data.
6. Rate-limit donation creation per phone/IP.

**Bookings**
7. `POST /bookings` re-validates the slot server-side (transactional unique `(provider, date, slot)`); a client submitting a booked/blocked slot gets 409 — frontend state is never trusted.
8. Duplicate booking (same phone + service + date) → 409.
9. Confirmation status returned by the server; app shows «قيد تأكيد الإدارة» until an admin confirms.
10. All times stored UTC, rendered Africa/Cairo.

**Authorization (403 matrix)**
11. Every admin endpoint checks role permissions; write an integration test per module (donations/content/cases/bookings/reports/roles) asserting each unauthorized role gets **403** for: approve/reject donation, edit case, edit project, edit impact numbers, read reports, read audit log.

**Audit log**
12. Every mutation writes: actor id, action, entity type, entity id, **previous value, new value**, timestamp, request IP + user-agent. Required for: donation approve/reject, case create/update, project create/update, booking status change, impact-number change, role/permission change. Audit entries are append-only.

**Notifications**
13. User push on donation approval/failure and booking confirmation; admin WhatsApp/notification on new manual transfer + new booking (integration credentials are the association's responsibility).

**Media (§9 of the UX spec)**
14. Admin uploads are the only image source (cases/projects/consultants/news/events). Server strips EXIF, resizes to max 1280px, re-encodes ~80% JPEG, and serves via CDN paths stored in `imageUrl`. The app renders them through `RemoteImage` (loading + broken-image + privacy-safe fallback already implemented).

---

## 17. What the demo does **not** persist (v1.4) — the backend's actual job

The QA acceptance pass established this precisely, and it is the shortest useful summary of the gap between the demo and a product. **Everything below is held in module-level JavaScript variables and is gone on reload or app restart.** The app now says so honestly on screen ("محفوظة أثناء الجلسة الحالية فقط") rather than claiming local storage it does not have.

| Demo state | Lives in | Survives restart? | Backend must own it as |
|---|---|---|---|
| Login session (`loggedIn`, `email`) | `mobile/src/store/appState.ts` | **No** | JWT access + refresh (§5.2) |
| Consultation requests | `appState.ts` | **No** | `consultation_requests` (§6) |
| Donation receipts | `appState.ts` | **No** | `donations` + receipts (§6) |
| Returning-guest identity map | `mobile/src/store/demoUsers.ts` | **No** | `users`, keyed on normalised email (§6) |
| Provider availability (days, slots, exception dates, accepting-bookings) | `mobile/src/store/providerStore.ts` | **No** | `provider_schedules` (§8) |
| Provider booking statuses + reschedules | `providerStore.ts` | **No** | `bookings` (§8) |
| Notification read state | `mobile/src/store/notifications.ts` | **No** | `notifications.read` (§6) |
| CMS content (menu, home, pages, media, consultation schemas, settings, payment methods) | `dashboard/src/store/cmsPersistence.ts` → `localStorage` | **Web only** | `cms_state` + `cms_media` (§6) |

### Two demo-only workarounds the backend replaces outright

1. **`localStorage` is partitioned per origin.** The dashboard and the Expo web build run on different ports, so a CMS edit in one is invisible to the other. The demo works around this with `scripts/demo-origin.mjs`, which serves both from a single port (app at `/`, dashboard at `/admin/`). A real API makes the whole problem disappear — **delete that script when the backend lands.** Native devices currently sync only via export/import JSON under *أدوات النظام*.

2. **No consultation data reaches the provider.** A request submitted in the app lands in `demoUsers`/`appState`; the provider dashboard reads a fixed three-booking seed in `providerStore`. They are unconnected stores, so **a consultation submitted live never appears in the provider's list.** Wiring `consultation_requests` → provider bookings is the first thing that makes the two halves one product, and it is the demo's most visible missing link.

### Two client decisions still open

- **Impact figures.** `1.2M+ مستفيد`, `+650 مبادرة`, `+10,000 متطوع` and the 2013–2025 timeline are unverified. They are now CMS-editable (`settings.stats`), so the foundation can correct or blank them without a release — but somebody has to confirm the real numbers. The `22 محافظة` claim was already removed; the app lists the 12 real governorates plus "وفي توسع مستمر…".
- **Social profile URLs.** All four still point at the website, so the app hides the row. Real URLs make it appear.

### Build note, not a backend concern but it will bite you

The mobile project is a **bare** Expo workflow — `android/` is committed, so `expo prebuild` never runs and **nothing in `app.json` reaches a native build**. Two defects came from exactly this: the version stayed at `1.0.0`/`versionCode 1` (D-19) and the launcher icon stayed the default Android robot (D-20). `scripts/sync-android-icons.mjs` and a manual `build.gradle` edit patch the symptoms; the durable fix is to adopt prebuild or run the sync scripts as part of CI. Also: the Android build fails from an exFAT volume (no hard links, which AGP requires) — build from a local disk or CI.
