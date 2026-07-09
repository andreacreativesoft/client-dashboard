# VSP — Client Dashboard

> Référence technique du dépôt, chargée à chaque session. Tenue à jour avec le code réel.
> Cadrage produit & avancement : voir `docs/` (commencer par `docs/README.md`).

## Produit

SaaS multi-tenant pour l'agence **Votre Site Pro** (Pedro). Permet à ses clients
commerçants/artisans (**non-techniques**) de voir, sans jargon, ce que leur site
leur rapporte : prospects, fréquentation, visibilité Google, et de demander des
modifications. Deux rôles : **admin** (agence) et **client** (commerçant).

Mission en cours = transformer un prototype trop large en **MVP livrable** :
resserrer le périmètre, simplifier le langage, stabiliser. Pas d'ajout de
fonctionnalités. Détails : `docs/Mission.md`.

## Stack

- **Front** : Next.js 16 (App Router), React 19, TypeScript strict (`noUncheckedIndexedAccess`)
- **UI** : Tailwind CSS v4, shadcn/ui (Radix), lucide-react, recharts, sonner
- **Forms** : react-hook-form + zod (schémas dans `lib/schemas/`)
- **Backend/DB** : Supabase Cloud (PostgreSQL + Auth + RLS)
- **Google APIs** : googleapis (GA4, GBP, GSC) via OAuth2
- **Email** : Resend · **Rate limit** : Upstash Redis (+ fallback mémoire)
- **Hébergement** : Vercel
- **Outillage** : pnpm, oxlint, oxfmt, tsc

## Commandes

```
pnpm dev            # dev server localhost:3000
pnpm build          # build production
pnpm check          # typecheck + lint + format:check (à lancer avant commit)
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint
pnpm format         # oxfmt .
pnpm db:seed        # seed la base (scripts/seed.ts)
```

Gestionnaire de paquets : **pnpm** (champ `packageManager`). Pas de framework de test configuré.

## Structure

```
app/
  (auth)/                  → login, forgot-password (hors layout sidebar)
  (dashboard)/             → routes protégées (sidebar + header)
    admin/                 → pages admin (layout guard rôle admin)
      clients/ [id]/       → clients : liste + détail (sites, intégrations, notes, activité)
      users/               → gestion utilisateurs + invitations
      websites/ [id]/      → vue des sites
    dashboard/             → accueil (overview client / vue agence admin)
    leads/ [id]/           → prospects : liste paginée + détail (notes, raw_data)
    tickets/ new/ [id]/    → demandes côté client (table + route = tickets ; mot affiché = "demande")
    analytics/             → GA4 (fréquentation, événements CTA, top pages, sources)
    search-console/        → GSC (clics, impressions, requêtes, position)
    business-profile/      → GBP (appels, itinéraires, vues, mots-clés)
    settings/              → profil utilisateur
  api/
    webhooks/lead/         → réception leads (POST) — dispatcher de connecteurs
    auth/google/           → OAuth Google (initiation + callback)
    cron/cleanup-cache/    → purge analytics_cache (auth CRON_SECRET)
    health/                → health check
  invite/[token]/          → acceptation d'invitation
  auth/callback/           → callback Supabase

components/
  ui/                      → primitives shadcn (button, card, input, dialog, select, pagination…)
  charts/                  → wrappers recharts (line, bar, donut)
  analytics/ admin/ layout/→ blocs métier, pages admin, sidebar/header/mobile-nav
  support-chat, client-switcher, impersonate-banner, …

lib/
  supabase/                → client (browser) · server (SSR cookie) · admin (service_role) · middleware
  actions/                 → server actions ("use server") — 1 fichier par domaine
  leads/connectors/        → architecture pluggable des connecteurs de leads (E4)
  schemas/                 → schémas zod (auth, invites, profile, requests)
  notifications/           → lead-notifications.ts (email Resend post-lead)
  i18n/                    → traductions maison (en / fr-BE / ro)
  constants.ts, auth.ts, google.ts, email.ts, rate-limit.ts, login-security.ts,
  impersonate.ts, utils.ts

types/                     → index, database (tables + Database générique), auth, api
supabase/migrations/       → 29 migrations SQL (001 → 029), à exécuter dans l'ordre
docs/                      → cadrage, suivi, modèle de données, UX (voir docs/README.md)
scripts/seed.ts            → seed de données de dev
```

## Base de données (13 tables)

`profiles`, `clients`, `client_users`, `websites`, `website_info`, `leads`,
`lead_notes`, `tickets`, `ticket_replies`, `integrations`, `analytics_cache`,
`invites`, `activity_logs`.

Modèle métier détaillé (clusters, flux, FK dénormalisées) : `docs/Domain-model.md`.

### Enums clés

- `UserRole` : `admin | client` · `AccessRole` (client_users) : `owner | viewer`
- `LeadStatus` : `new | contacted | done` (cycle CRM)
- `LeadSource` : `webhook | manual | api` — **audit système** (comment la ligne a été créée)
- `leads.connector` : slug texte (registry TS) — **système d'origine** du lead (`wordpress-form`, `generic-webhook`, …). Ne pas confondre avec `source`.
- `IntegrationType` : `ga4 | gbp | gsc`
- `TicketStatus` : `open | in_progress | waiting_on_client | closed`
- `AppLanguage` : `en | fr-BE | ro`

### Migrations

29 fichiers, exécutés dans l'ordre dans le SQL Editor Supabase. Pas d'outil de
migration (Prisma/Drizzle). On n'altère jamais une migration historique — on en
ajoute une nouvelle. `024` a droppé les modules gelés ; `026` a ajouté `leads.connector` ; `027` durcit la RLS CRM ; `028` ajoute les numéros de demandes ; `029` durcit la RLS `activity_logs`.

## Conventions

- **Server Components par défaut** ; `'use client'` seulement si interactivité.
- **Toutes les mutations** passent par des server actions dans `lib/actions/` (`"use server"`).
- **`requireAdmin()`** (`lib/auth.ts`) en tête de chaque action admin.
- **RLS sur chaque table**, jamais contournée depuis le front. `is_admin()` débloque l'admin.
- **`getProfile()`** utilise `React.cache()` (dédup par requête).
- Classes Tailwind conditionnelles via **`cn()`** (`lib/utils.ts`). Alias `@/*` = racine.
- Mobile-first (base 375px, breakpoint `md:` = 768px), cibles tactiles ≥ 44px.
- Palette monochrome (noir/blanc/gris) + sémantiques (success/warning/destructive). Le design final suit les maquettes (vert sapin / orange / blanc cassé).
- États de chargement via `loading.tsx` + `Skeleton`.
- Confirmations destructives via `useConfirm()` ; toasts via `sonner` (pas d'`alert()`/`confirm()` natifs).

## Webhook leads

`POST /api/webhooks/lead` — auth par clé API (`x-api-key` ou `?key=`). JSON ou
form-urlencoded. Rate limit 30/min par clé, 60/min par IP. CORS ouvert.

La route est un **dispatcher mince** : auth + rate limit → sélection du connecteur
via `websites.connector` → `connector.receive(payload)` → insertion. La
normalisation des champs (mapping explicite, multi-langue EN/RO/FR/NL/ES/DE/RU,
auto-détection par pattern) vit dans les connecteurs (`lib/leads/connectors/`).
Effet de bord à l'insertion : email Resend aux utilisateurs du client.
Ajouter une source = 1 fichier + 1 ligne de registry — voir `docs/Connecteurs.md`.

## Sécurité

- RLS partout (audit complet planifié, voir `docs/Suivi.md`).
- Sanitization du payload webhook (control chars, validation email/phone, troncature, 50 KB max).
- Tokens Google chiffrés AES (`TOKEN_ENCRYPTION_KEY`) ; refresh auto dans `lib/google.ts`.
- Rate limiting login (brute-force → blocage, déblocage admin) et OAuth.
- Security headers dans `next.config.ts` (nosniff, X-Frame-Options DENY, Referrer-Policy). Middleware = `proxy.ts` (Next 16) → `lib/supabase/middleware.ts` (refresh session + garde de routes).

## Variables d'environnement

Requises : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
Optionnelles : Resend, Google OAuth (`GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`), Upstash,
`CRON_SECRET`, reCAPTCHA. Template complet : `.env.example`.

## Modules retirés (ne pas re-coder par accident)

Supprimés du périmètre MVP en E1 — code et tables **droppés** : rapports PDF
(PDFKit), notifications push (web-push/VAPID), PWA (service worker, manifest,
offline), Facebook Conversion API, outils admin (broken-links / SEO audit /
uptime / security checks), module WordPress IA (SSH, mu-plugin, 40 outils).
Si une référence à `reports` / `push_subscriptions` / `site_checks` / `wordpress_*`
subsiste, c'est de la dette à nettoyer. Traçabilité : `docs/Backlog.md` §F20.

## Où trouver quoi

| Besoin                                        | Doc                    |
| --------------------------------------------- | ---------------------- |
| Par où commencer, ordre de lecture            | `docs/README.md`       |
| Périmètre, objectifs, ce qui est in/out       | `docs/Mission.md`      |
| Où on en est, prochaines étapes, heures       | `docs/Suivi.md`        |
| Catalogue des fonctionnalités (existe ? où ?) | `docs/Backlog.md`      |
| Modèle de données, flux métier                | `docs/Domain-model.md` |
| Vocabulaire client (anti-jargon)              | `docs/UX-glossaire.md` |
| Parcours utilisateurs                         | `docs/UX-parcours.md`  |
| Ajouter un connecteur de leads                | `docs/Connecteurs.md`  |
| Roadmap contractuelle (figée)                 | `docs/Roadmap.md`      |
