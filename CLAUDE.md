# Client Dashboard Platform

## Overview
Standalone SaaS PWA for agency clients to view leads and business analytics.
Multi-tenant: Admin (agency owner) and Client (business owner) roles.
Source-agnostic — receives data from any website via webhooks and API keys.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), TypeScript (strict)
- **Styling:** Tailwind CSS v4 (monochrome black/white/grey palette)
- **Backend/DB:** Supabase Cloud (PostgreSQL + Auth + RLS)
- **Hosting:** Vercel (planned)
- **PWA:** Installable, mobile-first (375px base)

## Commands
- `npm run dev` — Start dev server on localhost:3000
- `npm run build` — Production build
- `npm run lint` — ESLint check

## Project Structure
```
app/
  (auth)/         → Login, forgot password (no sidebar)
  (dashboard)/    → Dashboard, leads, analytics, settings (sidebar + header)
    admin/        → Admin-only pages (client/user/website management)
  api/            → Webhook endpoint, health check
components/
  ui/             → Button, Card, Input, Badge, Skeleton, Modal, Label, Textarea
  layout/         → Sidebar, Header, MobileNav
lib/
  supabase/       → Browser client, server client, admin client, middleware
  actions/        → Server actions (clients, websites, users, leads, profile)
  utils.ts        → cn(), formatDate(), timeAgo(), slugify(), formatNumber()
types/
  database.ts     → All table types + Database type for Supabase
  auth.ts         → AuthUser, SessionContext
  api.ts          → API response types, webhook payload
supabase/
  migrations/     → SQL schema with RLS
```

## Conventions
- Server Components by default; `'use client'` only when needed
- Supabase SSR patterns via `@supabase/ssr`
- Mobile-first Tailwind (min-width breakpoints)
- 44px minimum tap targets on interactive elements
- Loading states via `loading.tsx` files with Skeleton components
- TypeScript strict with `noUncheckedIndexedAccess`
- RLS on every table — never bypass from frontend
- Webhook endpoint uses admin client (service_role) to bypass RLS

## Database
8 tables with full RLS: profiles, clients, client_users, websites, leads, lead_notes, integrations, analytics_cache. See `supabase/migrations/001_initial_schema.sql`.

## Current Status
- Phase 1: Foundation ✅
- Phase 2: Authentication ✅
- Phase 3: Admin Panel ✅ (client/website/user CRUD)
- Phase 4: Leads ✅ (list, detail, status, notes, filters)
- Phase 5: Analytics (partial) ✅ (lead stats, charts) — Google integrations pending

## Webhook API
Receives leads from any source (Elementor, Contact Form 7, WPForms, etc.)

**Endpoint:** `POST /api/webhooks/lead`
**Auth:** API key via `x-api-key` header OR `?key=` query param

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
Supports various field names: `your_name`, `your_email`, `first_name`+`last_name`, `fields.name`, etc.

**Response:** `{ "success": true, "lead_id": "uuid" }`

**Test endpoint:** `GET /api/webhooks/lead?key=<api_key>` returns status.

## Supabase Setup (Required)
1. Create a project at https://supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Copy project URL + anon key + service role key into `.env.local`
4. Create first admin user: Authentication > Users > Add User (email+password)
5. Then in SQL Editor: `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`

## Features
- **Admin:** Create/edit/delete clients, websites (with API key generation), users
- **Leads:** View all leads, filter by status, search, change status, add notes
- **Analytics:** Lead trends (30-day chart), status breakdown, top sources
- **Settings:** Update profile name/phone, change password
- **Dashboard:** Stats overview, recent leads list
