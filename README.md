# VSP — Client Dashboard

Tableau de bord SaaS multi-tenant pour l'agence **Votre Site Pro**. Permet à ses
clients (commerçants, artisans — non-techniques) de suivre, sans jargon, ce que
leur site web leur rapporte : prospects, fréquentation, visibilité Google, et de
demander des modifications.

Stack : Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase
(PostgreSQL + Auth + RLS) · Tailwind v4 + shadcn/ui · déployé sur Vercel.

## Démarrer en local (Supabase CLI + Docker)

Prérequis : **Node ≥ 20**, **pnpm ≥ 11**, **Docker** lancé.

```bash
# 1. Dépendances
pnpm install

# 2. Stack Supabase locale (Postgres + Auth + Studio… dans Docker)
npx supabase start

# 3. Récupérer les clés locales et renseigner .env.local
cp .env.example .env.local
npx supabase status            # copie ANON_KEY + SERVICE_ROLE_KEY (format JWT « eyJ… »)
#   → NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   → NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
#   → SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

# 4. (Re)construire la base : rejoue les migrations 001→027 + supabase/seed.sql
npx supabase db reset

# 5. Données de démo (clients, sites, ~90 leads, tickets, 4 comptes)
pnpm db:seed                   # ou : pnpm db:seed:reset (clear + create)

# 6. Lancer l'app
pnpm dev                       # http://localhost:8201
```

> ⚠️ **Clés d'API** : utilise bien les clés **JWT legacy** (`eyJ…`) renvoyées par
> `npx supabase status`, **pas** les nouvelles clés `sb_publishable_` /
> `sb_secret_` — le PostgREST local ne les mappe pas sur `service_role`
> (→ « permission denied »).

**Comptes de démo** (mot de passe `password`) :

| Rôle   | Email                                                   |
| ------ | ------------------------------------------------------- |
| admin  | `admin@vsp.local`                                       |
| client | `marie@vsp.local`, `paul@vsp.local`, `sophie@vsp.local` |

**URLs locales** : App http://localhost:8201 · Studio http://localhost:54323 ·
Mailpit (emails interceptés) http://localhost:54324

Avant de committer : `pnpm check` (typecheck + lint + format).

### `supabase/seed.sql` (dev local uniquement)

`db reset` rejoue `supabase/seed.sql` après les migrations. Il y réaccorde le DML
(`select/insert/update/delete`) aux rôles `anon` / `authenticated` /
`service_role` : les images Supabase CLI récentes ne le font plus
automatiquement, alors que le cloud si. Sans ça, l'app **et** le seed échouent en
« permission denied ». Ce fichier n'est **jamais** exécuté sur le cloud.

## Supabase (production / cloud)

1. Créer un projet sur https://supabase.com
2. Exécuter les migrations `supabase/migrations/001 → 027` dans l'ordre (SQL Editor)
3. Renseigner URL + anon key + service role key dans les variables d'env Vercel
4. Créer un premier admin : Authentication > Users, puis
   `UPDATE profiles SET role = 'admin' WHERE email = 'vous@exemple.com';`

## Documentation

Toute la doc de travail est dans [`docs/`](docs/). **Commencez par
[`docs/README.md`](docs/README.md)** (ordre de lecture selon votre besoin).
La référence technique pour l'IA est [`CLAUDE.md`](CLAUDE.md).
