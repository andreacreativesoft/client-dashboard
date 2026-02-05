# Client Dashboard Platform

## Overview
Standalone SaaS PWA for agency clients to view leads and business analytics.
Multi-tenant: Admin (agency owner) and Client (business owner) roles.
Source-agnostic — receives data from any website via webhooks and API keys.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), TypeScript (strict)
- **Styling:** Tailwind CSS v4 (monochrome black/white/grey palette)
- **Charts:** Recharts
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
  (admin)/        → Admin-only pages (client/user/website/integration management)
  api/            → Webhook endpoint, health check, crons
components/
  ui/             → Button, Card, Input, Badge, Skeleton
  layout/         → Sidebar, Header, MobileNav
lib/
  supabase/       → Browser client, server client, admin client, middleware
  utils.ts        → cn(), formatDate(), timeAgo(), slugify()
  constants.ts    → Lead statuses, nav items, date ranges
types/
  database.ts     → All table interfaces + Database type
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
Phase 1 complete (Foundation). Phase 2 complete (Authentication). Ready for Phase 3 (Admin Panel).

## Supabase Setup (Required)
1. Create a project at https://supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Copy project URL + anon key + service role key into `.env.local`
4. Create first admin user: Authentication > Users > Add User (email+password)
5. Then in SQL Editor: `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`
