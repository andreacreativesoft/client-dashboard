# Client Dashboard Platform

## Overview
Standalone SaaS PWA for agency clients to view leads and business analytics.
Multi-tenant: Admin (agency owner) and Client (business owner) roles.
Source-agnostic — receives data from any website via webhooks and API keys.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4 (monochrome black/white/grey palette)
- **Backend/DB:** Supabase Cloud (PostgreSQL + Auth + RLS)
- **Email:** Resend
- **PDF:** PDFKit
- **Push:** web-push (VAPID)
- **Google APIs:** googleapis (GA4, GBP)
- **Hosting:** Vercel
- **PWA:** Installable, mobile-first (375px base)

## Commands
- `npm run dev` — Start dev server on localhost:3000
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint check

No test framework is configured yet.

## Project Structure
```
app/
  (auth)/                → Login, forgot password (no sidebar layout)
  (dashboard)/           → Protected routes (sidebar + header layout)
    admin/               → Admin-only pages (role-guarded layout)
      clients/           → Client list & creation
      clients/[id]/      → Client detail (websites, integrations, notes, activity)
      users/             → User management
      websites/          → Website overview
      tools/             → Admin tools (broken links, SEO audit, uptime)
    leads/               → Lead list (paginated, filterable)
    leads/[id]/          → Lead detail with notes
    analytics/           → Lead analytics + GA4 website analytics (CTA events, traffic)
    reports/             → PDF report generation & downloads
    settings/            → User profile settings
    dashboard/           → Overview page (stats, recent leads)
  api/
    webhooks/lead/       → Inbound lead webhook (POST + GET test)
    auth/google/         → OAuth initiation + callback
    health/              → Health check endpoint
    push/subscribe/      → Push notification subscription
    reports/generate/    → PDF generation
    reports/[id]/        → Report download
    tools/broken-links/  → Broken link checker API
    tools/seo-audit/     → SEO audit API
    tools/uptime/        → Uptime monitor API
  auth/callback/         → Supabase auth callback
  invite/[token]/        → Invite acceptance

components/
  ui/                    → Button, Card, Input, Badge, Skeleton, Modal, Label, Textarea
  analytics/
    ga4-analytics.tsx    → GA4 dashboard (sessions, events, CTA tracking, top pages, traffic sources)
  layout/                → Sidebar (collapsible), Header, MobileNav, SidebarContext
  activity-log.tsx       → Activity timeline display
  client-alerts.tsx      → Push/email alert notifications
  client-switcher.tsx    → Admin client selection dropdown
  impersonate-banner.tsx → Admin impersonation indicator
  push-notification-toggle.tsx
  theme-provider.tsx     → Dark/light mode context
  theme-toggle.tsx       → Theme switcher button

lib/
  supabase/
    client.ts            → Browser client (anon key)
    server.ts            → Server client (SSR, cookie-based)
    admin.ts             → Admin client (service_role, bypasses RLS)
    middleware.ts         → Auth session refresh + route protection
  actions/               → Server actions ("use server")
    profile.ts           → getProfile(), updateProfileAction(), changePasswordAction()
    clients.ts           → CRUD + getClientDetail()
    websites.ts          → CRUD + regenerateApiKeyAction()
    leads.ts             → getLeadsPaginated(), updateLeadStatusAction()
    lead-notes.ts        → Note CRUD
    users.ts             → User CRUD + invite
    integrations.ts      → GA4/GBP/Facebook integration management
    analytics.ts         → fetchGA4Analytics(), getClientsWithGA4() — on-demand GA4 data with caching
    invites.ts           → sendInviteAction(), acceptInviteAction()
    activity.ts          → logActivityAction(), getActivityLogs()
    alerts.ts            → updateLastLogin()
    impersonate.ts       → startImpersonation(), endImpersonation()
  constants/
    constants.ts         → LEAD_STATUSES, USER_ROLES, NAV_ITEMS
    activity.ts          → Activity type constants
  reports/
    gather-data.ts       → Data aggregation for reports
    generate.ts          → PDF generation with PDFKit
    pdf-template.ts      → PDF layout & styling
    types.ts             → Report data types
  auth.ts                → requireAdmin() utility
  utils.ts               → cn(), formatDate(), timeAgo(), slugify(), formatNumber()
  rate-limit.ts          → Sliding window rate limiter (in-memory)
  email.ts               → Resend templates (new lead, welcome, invite)
  google.ts              → OAuth2, token encrypt/decrypt, GA4 (data, events, pages, sources), GBP API
  facebook.ts            → Conversion tracking (SHA256 hashed data)
  push.ts                → Web push send (single + batch)
  impersonate.ts         → Impersonation helpers

types/
  index.ts               → Re-exports all types
  database.ts            → All DB table types + Supabase Database generic type
  auth.ts                → AuthUser, SessionContext, isAdmin()
  api.ts                 → ApiResponse<T>, PaginatedResponse<T>, WebhookLeadPayload

supabase/
  migrations/            → 8 SQL files (run in order)
    001_initial_schema.sql      → 8 core tables + RLS + triggers
    002_push_subscriptions.sql  → Push notification subscriptions
    003_reports.sql             → PDF reports table + storage bucket
    004_invites.sql             → Invite system with tokens
    005_activity_logs.sql       → Immutable activity log
    006_client_alerts.sql       → last_login_at column on profiles
    007_performance_indexes.sql → 8 indexes on hot columns
    008_site_checks.sql         → Admin tools (broken links, SEO, uptime) table

public/
  sw.js                  → Service worker (network-first, cache fallback)
  offline.html           → Offline fallback page
```

## Conventions

### Code Style
- Server Components by default; `'use client'` only when interactivity is needed
- TypeScript strict with `noUncheckedIndexedAccess` enabled
- Path alias: `@/*` maps to project root
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes (clsx + tailwind-merge)

### Supabase Patterns
- SSR via `@supabase/ssr` — server client uses cookie-based auth
- Browser client (`lib/supabase/client.ts`) for client components
- Server client (`lib/supabase/server.ts`) for server components and server actions
- Admin client (`lib/supabase/admin.ts`) for service_role operations (webhooks, admin tasks)
- RLS on every table — never bypass from frontend code
- `getProfile()` uses `React.cache()` for per-request deduplication

### Styling
- Mobile-first Tailwind (min-width breakpoints: `md:` = 768px)
- Monochrome palette: black/white/grey with semantic colors (success/warning/destructive)
- 44px minimum tap targets on all interactive elements
- Loading states via `loading.tsx` files using Skeleton components

### Data Flow
- Server actions in `lib/actions/` handle all mutations (marked `"use server"`)
- Admin actions call `requireAdmin()` from `lib/auth.ts` before proceeding
- Leads table has denormalized `client_id` to avoid 3-table joins
- Pagination: 25 items per page

### Routing
- Route groups: `(auth)` for public pages, `(dashboard)` for protected pages
- Admin routes have their own `layout.tsx` that enforces admin role
- Middleware (`middleware.ts`) refreshes sessions and handles redirects
- Public routes (no auth required): `/login`, `/forgot-password`, `/invite/[token]`, `/auth/callback`, `/api/webhooks/*`, `/api/health`

## Database

### Tables (14 total)
**Core (8):** profiles, clients, client_users, websites, leads, lead_notes, integrations, analytics_cache
**System (6):** push_subscriptions, reports, invites, activity_logs, site_checks (+ last_login_at on profiles)

### Key Types
- `UserRole`: `"admin" | "client"`
- `AccessRole`: `"owner" | "viewer"` (client_users)
- Lead status: `"new" | "contacted" | "done"`
- Integration type: `"ga4" | "gbp" | "facebook"`
- Lead source: `"webhook" | "manual" | "api"`
- Check type: `"broken_links" | "seo_audit" | "uptime"`
- Check status: `"running" | "completed" | "failed"`

### RLS Rules
- `is_admin()` function checks profile role — admins can access all rows
- Clients see only their assigned clients via client_users join
- Users can read/update their own profile
- activity_logs is insert-only (immutable)

### Migrations
Run all 8 migrations in order (001 through 008) in Supabase SQL Editor. See `supabase/migrations/`.

## Environment Variables

### Required
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Client Dashboard
```

### Optional — Email (Resend)
```
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=notifications@yourdomain.com
```

### Optional — Push Notifications
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### Optional — Google OAuth (GA4/GBP)
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
TOKEN_ENCRYPTION_KEY=...   # Min 32 bytes, for AES token encryption
```

See `.env.example` for the full template.

## Webhook API

**Endpoint:** `POST /api/webhooks/lead`
**Auth:** API key via `x-api-key` header OR `?key=` query param
**Rate limits:** 30 req/min per API key, 60 req/min per IP
**CORS:** Enabled (Access-Control-Allow-Origin: *)
**Content types:** `application/json` and `application/x-www-form-urlencoded`

**Request Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "message": "Contact message",
  "form_name": "contact-form"
}
```

**Multi-language field detection:** Supports English, Romanian, French, Dutch, Spanish, German, Russian field names (e.g. `Nume`, `Telefon`, `Mesaj`, `nom`, `nombre`). Auto-detects email by `@` pattern, phone by digit count, name/message by length. Compatible with Elementor, Contact Form 7, WPForms, Gravity Forms.

**Response:** `{ "success": true, "lead_id": "uuid" }` (status 200)
**Test:** `GET /api/webhooks/lead?key=<api_key>` returns webhook status.

**Side effects on lead creation:**
- Email notification to all users linked to the client
- Push notification to subscribed users
- Facebook Conversion API event (if Facebook Pixel integration is active)

## Security & Performance
- **RLS everywhere** — enforced at database level, never bypassed from frontend
- **Webhook rate limiting** — sliding window in-memory (30/min per key, 60/min per IP)
- **Input sanitization** — control char stripping, email/phone validation, field truncation, 50KB raw_data limit
- **Admin role checks** — `requireAdmin()` on all admin server actions
- **Token encryption** — AES for Google/Facebook tokens via `TOKEN_ENCRYPTION_KEY`
- **Security headers** — X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin
- **DB indexes** — 8 performance indexes on hot columns (migrations/007)
- **Profile caching** — `React.cache()` dedupes per-request
- **API key generation** — `crypto.randomUUID()` for websites, `gen_random_bytes(32)` in DB

## PWA Configuration
- **Manifest:** `app/manifest.ts` — standalone display, portrait orientation
- **Service Worker:** `public/sw.js` — network-first strategy, precaches `/`, `/dashboard`, `/leads`
- **Offline:** `public/offline.html` — fallback page with retry button
- **Push:** Listens for push events in service worker, subscription via `/api/push/subscribe`
- **Cache:** `client-dashboard-v1`, auto-cleanup of old caches on activation

## Supabase Setup
1. Create project at https://supabase.com
2. Run ALL migrations in order in SQL Editor (001 through 008)
3. Copy project URL + anon key + service role key into `.env.local`
4. Create first admin: Authentication > Users > Add User (email+password)
5. Promote to admin: `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`

## Google OAuth Setup (Optional)
1. Google Cloud Console > APIs & Services > Credentials > Create OAuth 2.0 Client ID
2. Redirect URI: `https://yourdomain.com/api/auth/google/callback`
3. Enable APIs: Analytics Data API, Analytics Admin API, My Business Account Management, My Business Business Information
4. Add credentials to `.env.local`

## Current Status
- Phase 1: Foundation ✅
- Phase 2: Authentication ✅
- Phase 3: Admin Panel ✅ (client/website/user CRUD)
- Phase 4: Leads ✅ (list, detail, status, notes, filters, pagination)
- Phase 5: Analytics ✅ (lead stats + GA4 website analytics with CTA event tracking)
- Phase 6: Integrations ✅ (GA4, GBP, Facebook Pixel — per-website in client detail)
- Phase 7: Optimization ✅ (rate limiting, input sanitization, DB indexes, code deduplication)
- Phase 8: Reports ✅ (PDF generation, per-client, date range)
- Phase 9: Notifications ✅ (push notifications, email alerts, activity logs)
- Phase 10: Invites & Impersonation ✅ (token-based invites, admin impersonation)
- Phase 11: Admin Tools ✅ (broken link checker, SEO auditor, uptime monitor)
- Phase 12: GA4 Analytics ✅ (sessions, users, pageviews, bounce rate, CTA events, top pages, traffic sources, 30-min caching, auto token refresh)
- Phase 13: Webhook Enhancements ✅ (CORS, form-urlencoded, multi-language field detection, auto-detect by value pattern)

## WordPress AI Dashboard

The AI command system lets admins manage WordPress sites via natural language.
Full capabilities reference: **`lib/wordpress/AI_CAPABILITIES.md`**

**Rule:** When adding, removing, or changing any AI tool, endpoint, or capability, always update `lib/wordpress/AI_CAPABILITIES.md` to match. This file is the single source of truth for what the dashboard AI can and cannot do.
