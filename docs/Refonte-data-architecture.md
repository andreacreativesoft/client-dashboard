# Refonte data — websites, connecteurs, intégrations, attributs, uptime

> Chantier de refonte du cœur « sites & collecte ». Repart d'une page blanche sur
> l'architecture de données de ces features, en gardant `clients` comme pivot.
> Statut vivant — coché au fur et à mesure. Décisions actées : voir `Suivi.md`.

## Pourquoi

L'existant a trois défauts structurels (constatés dans le code) :

1. **Mauvais pivot analytics** — `integrations` et `analytics_cache` sont clés sur
   `client_id`, alors qu'une intégration GA4/GBP/GSC concerne **un site**.
2. **Connecteur dégénéré** — simple colonne texte sur `websites` (1 site = 1
   connecteur), concepts morts (`canHandle` jamais appelé, `reply` non implémenté),
   liste dupliquée (registry + dropdown), `webhook_secret` jamais vérifié.
3. **Métadonnées éparpillées** — colonnes décoratives `git_repo_url/asana/figma`
    - table fourre-tout `website_info`, sans presets ni rendu typé.

## Principes de la cible

- **`clients` = pivot.** Possède des `websites` (1-N) et des accès users (N-N via
  `client_users`). Inchangé.
- **`websites` = point d'ancrage** des connecteurs, intégrations, attributs, uptime.
- **Pas de double-clé.** Une table fille d'un site porte `website_id` **seulement**
  (le client se dérive par jointure `website → client`). Seules les tables qui
  pendent **directement** du client portent `client_id`.
- **Exception assumée : les `submissions`** (ex-`leads`) portent `client_id` +
  `connector_id` nullable, **pas** de `website_id`. Une submission appartient
  toujours à un client (issue d'un connecteur, ou saisie manuelle) et se gère
  dans l'espace client.
- **Stockage des credentials générique** (pas spécifique Google) pour brancher
  d'autres systèmes plus tard.
- **`activity_logs`** alimenté dans **chaque** mutation pertinente.

## Renommage : `leads` → `submissions`

Le terme « lead » est trop étroit (un envoi peut être un prospect, un formulaire,
une demande). On renomme le concept technique en **`submissions`** partout dans le
code et la base.

> ⚠️ On ne réutilise **pas** `tickets` : déjà pris par le module Demandes
> (`tickets` / `ticket_replies`, UI « demande »).

Le **nom humain affiché** ne vit pas dans le type technique mais sur le connecteur,
via `connectors.label` (« Prospect » / « Formulaire » / « Ticket » selon le contexte).
`lead_notes` → `submission_notes`.

## Modèle cible

```
clients (pivot)
├── client_users → profiles                       accès N-N (owner/viewer)
├── connected_accounts          (client_id)        credentials OAuth génériques
└── websites                    (client_id)        ancre du reste
     ├── connectors             (website_id)       portes de collecte
     │    └── submissions       (client_id + connector_id nullable)  ← géré sous client
     │         └── submission_notes (submission_id)
     ├── integrations           (website_id)       → connected_accounts, service, ressource
     │    └── analytics_cache   (website_id)
     ├── attributes             (website_id)       métadonnées à presets
     └── uptime_checks          (website_id)       historique de disponibilité
          └── uptime_incidents  (website_id)       périodes down dérivées
```

### Tables

**`websites`** (modifié) : `+ platform varchar(50)` (`wordpress|shopify|wix|webflow|
prestashop|custom|other` — valeurs connues mais non-enum, extensible),
`+ uptime_enabled boolean`. On **retire** `git_repo_url/asana_project_url/figma_url`
(→ `attributes`) et `api_key/webhook_secret` (→ `connectors`) à la bascule.

**`connected_accounts`** (nouveau, `client_id`) — credential agnostique :
`provider ('google'|…)`, `external_account_id`, `external_account_label`,
`access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`,
`scopes text[]`, `metadata jsonb`, `is_active`. Tokens chiffrés AES-256-GCM.

**`connectors`** (nouveau, `website_id`) — une porte de collecte :
`kind` (slug de stratégie de parsing, registry TS = source unique),
`name` (nom de la porte), `label` (nom humain des items produits),
`ingest_token` (unique, secret d'entrée), `signing_secret` (HMAC),
`config jsonb`, `is_active`.

**`submissions`** (ex-`leads`, `client_id` + `connector_id` nullable) :
`form_name`, `source ('webhook'|'manual'|'api')`, `name`, `email`, `phone`,
`message`, `raw_data jsonb`, `status ('new'|'contacted'|'done')`, `submitted_at`.
On **retire** `website_id` et la colonne texte `connector`.

**`integrations`** (refondu, `website_id`) — liaison site ↔ ressource :
`account_id (FK→connected_accounts)`, `service ('ga4'|'gbp'|'gsc')`,
`resource_id` (property/location/site), `resource_label`, `config jsonb`,
`is_active`. **Plus de tokens ici** (vivent dans `connected_accounts`).

**`analytics_cache`** (re-clé `website_id`) :
`(website_id, service, metric_type, period_start, period_end)` unique.

**`attributes`** (nouveau, `website_id`) — métadonnées à presets :
`type` (slug de preset, ou `null` = texte libre), `title` (pré-rempli depuis le
preset, éditable), `value`, `is_sensitive`, `is_admin_only`, `sort_order`.
Le registry de presets (code) attache à chaque `type` : icône, `value_kind`
(`url|secret|email|text`) + validation, rendu UI, `is_sensitive` par défaut.

**`uptime_checks`** (nouveau, `website_id`) :
`checked_at`, `status ('up'|'down'|'degraded')`, `http_status`, `response_ms`,
`error`. Index `(website_id, checked_at desc)`. Statut courant = `DISTINCT ON`.
**`uptime_incidents`** (nouveau) : `started_at`, `resolved_at`, `last_status`
— dérivé des checks pour l'affichage « incident du … » et l'uptime %.
Intervalle de check **paramétrable** (décidé plus tard ; config + override par site).

> **⚠️ TODO — collecteur uptime (à faire plus tard).**
> L'**UI est faite** : onglet « Uptime » dans la section sites de la fiche client
> (`websites-list.tsx` → `uptime-board.tsx`), alimenté par `getUptimeForWebsite()`
> (`lib/actions/uptime.ts`) qui lit `uptime_checks` / `uptime_incidents` (statut
> courant, dispo % sur 30 j, temps de réponse, incidents). **Ce qui manque** : le
> **collecteur** qui peuple ces tables — un job (cron Vercel ou edge function) qui
> ping chaque site `uptime_enabled`, écrit un `uptime_check`, et dérive les
> `uptime_incidents` (ouverture/fermeture). Tant qu'il n'existe pas, l'onglet
> affiche « Surveillance activée — aucune mesure pour l'instant ».

## Connecteurs — fonctionnement cible

- Un connecteur = entité en base attachée à **1 site**, avec son `ingest_token`.
  Un site peut en avoir plusieurs (form WP + webhook custom).
- **Un endpoint dédié et adapté par système**, pas un endpoint générique unique :
  `POST /api/ingest/<kind>/[token]` (ex. `/api/ingest/wordpress-form/[token]`,
  `/api/ingest/generic-webhook/[token]`, demain `/api/ingest/typeform/[token]`,
  `/api/ingest/facebook/[token]` avec son challenge GET + signature). Chaque route
  est taillée pour les conventions de son système (format de payload, schéma de
  signature, handshake) → **installation triviale** côté client.
- La **plomberie commune** (rate limit, résolution du token, insert + activity +
  notif) vit dans `lib/connectors/ingest.ts` ; la **normalisation** dans le parseur
  du `kind` (`lib/connectors/parsers/<kind>.ts`). Ajouter un système = 1 parseur
    - 1 route dédiée + 1 ligne de registry.
- On **supprime** `canHandle`, `reply`, `capabilities` (YAGNI).

## Intégrations analytics — fonctionnement cible

- `connected_accounts` = LE login Google (tokens, scopes). Une `integration` ne fait
  que **lier un site à une ressource** (property GA4 / location GBP / site GSC) via
  un credential. Brancher Meta/Microsoft demain = un nouveau `provider`, zéro refonte.
- On **garde** ce qui marche : OAuth, AES-256-GCM, refresh auto, cache 30 min, et le
  **vocabulaire pédagogique** côté client (`UX-glossaire`). Refactor = re-clé + split
  credential/liaison + nettoyage.

## Règle absolue : zéro legacy

Le projet **n'est pas en prod**. On **supprime** l'ancien schéma et l'ancien code,
on ne les maintient jamais en parallèle et on ne code **jamais** « en fonction » du
legacy. Chaque chantier remplace **et supprime** dans la foulée — pas de nettoyage
différé, pas de route/colonne/table conservée « au cas où ».

## Schéma — terminé

On n'altère jamais une migration historique : on ajoute (030+).

- [x] **030 — Fondations** ✅ `030_data_refonte_foundations.sql`
      `websites.platform` + `uptime_enabled` ; tables `connected_accounts`,
      `connectors` (1/site), `attributes` (depuis `website_info` + liens),
      `uptime_checks`, `uptime_incidents`. RLS sur chaque table.
- [x] **031 — Bascule destructive** ✅ `031_data_refonte_cutover.sql`
      `leads`→`submissions` (`+ connector_id`, `- website_id`, `- connector`),
      `lead_notes`→`submission_notes`, drop colonnes legacy `websites`, drop
      `website_info`, recréation propre de `integrations`/`analytics_cache`
      (clés sur `website_id`). Validée en local (69 submissions ré-rattachées).

Schéma cible en place : plus aucune trace legacy en base.

## Chantiers code (chacun remplace ET supprime l'ancien code)

- [x] **Connecteurs** ✅ : registry `kind`→parser (`canHandle`/`reply`/`capabilities`
      supprimés, source unique) ; **endpoints dédiés par système** `POST /api/ingest/<kind>/[token]` + signature HMAC (obligatoire par défaut sur generic) ; **`/api/webhooks/lead` supprimée** ;
      CRUD connecteurs + URL d'ingestion sous le site ; `activity_logs`.
- [x] **Submissions** ✅ : `leads`→`submissions` dans tout le code
      (`lib/`, `app/(dashboard)/submissions`, actions, composants, types) ;
      `connector_id` + `label` humain branchés. Code `leads` supprimé.
- [x] **Creds + intégrations** ✅ : `connected_accounts` (OAuth générique, callback liste
      les ressources) ; liaison `integrations(website_id)` + UI de binding par service ;
      analytics re-clé `website_id` (sélecteur par site). Code client-keyed supprimé.
- [x] **Attributs** ✅ : registry de presets + éditeur (`attributes-board`, presets /
      texte libre, `is_sensitive`, `is_admin_only`) ; `website_info`/`info-board` et
      champs liens supprimés ; rendu UI typé.
- [ ] **Uptime** : cron de check (infra `/api/cron` + `CRON_SECRET`), écriture checks + calcul incidents, UI statut client pédagogique, config (intervalle paramétrable).
- [x] **types** ✅ `types/database.ts` + `scripts/seed.ts` au schéma réel.
      Reste : `Domain-model.md`, `Connecteurs.md`, `Backlog.md`, `CLAUDE.md`.

## Périmètre acté (vs MVP initial)

- **Uptime** était coupé du MVP (E1, migration 024 `site_checks` droppée). Ré-ouvert
  ici en version **complète** (historique + incidents), sur décision client (2026-06-17).
- **Connecteurs `reply` / multi-canaux** restent hors scope (V2).
