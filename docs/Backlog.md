# Product Backlog — VSP Client Dashboard

> **But** : catalogue précis des capacités utilisateur de l'app (existe ? où ? statut ?). Complète `Suivi.md`, qui donne la vue d'ensemble de l'avancement.
>
> **Mise à jour** : 2026-06-16 — E1→E6 livrés, reste le buffer (tests e2e, doc déploiement).

## Légendes

| Statut | Signification          |     | Évolution | Signification                                         |
| ------ | ---------------------- | --- | --------- | ----------------------------------------------------- |
| ✅     | Fonctionnel            |     | (vide)    | Présent à `initial-fork`, inchangé ou modifs mineures |
| ⚠️     | Dette / bug / partiel  |     | 🆕        | Ajouté depuis `initial-fork`                          |
| 🔄     | En cours               |     | 🔧        | Présent à `initial-fork`, refactoré significativement |
| 📋     | Planifié, pas commencé |     | 🗑️        | Existait à `initial-fork`, retiré depuis              |
| 🗑️     | Retiré (cf. F20)       |     |           |                                                       |

Le tag `initial-fork` représente le projet tel qu'on l'a reçu (~36k LOC). La mission étant un cleanup + modernisation, ces marqueurs tracent la valeur apportée.

## Personae

| Code       | Persona                             | Profil                                                          |
| ---------- | ----------------------------------- | --------------------------------------------------------------- |
| **Admin**  | Pedro — agence Votre Site Pro       | Accès complet multi-clients (gère tous ses clients commerçants) |
| **Client** | Marie Dubois (restaurant Le Jardin) | Commerçant non-technique, mobile-first                          |
| **System** | Sites WordPress externes            | Envoient les leads via webhook                                  |

> **Note** : Orange Bleu (Mathias Billot) est le prestataire qui développe ce SaaS pour Pedro. Pedro est le client de la mission **et** l'utilisateur final du rôle Admin. Marie est le persona-cible côté Client.

---

## Évolution depuis `initial-fork`

### Chantier 1 — Tooling

| Action | Détail                                     | Commits              |
| ------ | ------------------------------------------ | -------------------- |
| Switch | ESLint + Prettier → **oxlint + oxfmt**     | `46f027e`            |
| Format | Ré-application formatteur sur tout le repo | `a88281b`, `2729ea3` |

### Chantier 2 — Cleanup E1 (modules figés retirés)

| Module retiré                | Surface supprimée                                                                | Commit    |
| ---------------------------- | -------------------------------------------------------------------------------- | --------- |
| PWA                          | `public/sw.js`, `public/offline.html`, `app/manifest.ts`                         | `06f265f` |
| Push notifications           | `app/api/push/*`, `lib/push.ts`, dep `web-push`                                  | `23f2c90` |
| Facebook Conversion API      | `lib/facebook.ts`                                                                | `96ab735` |
| PDF Reports mensuels         | `app/(dashboard)/reports/*`, `app/api/reports/*`, dep `pdfkit`                   | `492cf72` |
| WordPress AI                 | `app/api/wordpress/*`, `lib/actions/wordpress*.ts`, `admin/ai-settings/*`        | `f12f40b` |
| Admin tools                  | `app/api/tools/*`, `app/(dashboard)/admin/tools/*`, `lib/actions/site-checks.ts` | `673224b` |
| Types/constants/i18n/sidebar | Cohérence après retraits                                                         | `83679fa` |
| Tables DB associées          | Migration `024_drop_frozen_modules`                                              | `c7fbbd8` |

### Chantier 3 — Documentation UX & cadrage

| Doc                       | Contenu                                                      | Commit               |
| ------------------------- | ------------------------------------------------------------ | -------------------- |
| `docs/UX-glossaire.md` 🆕 | 11 sections vocabulaire (statuts, sources, KPI, vocab banni) | `4bc6327`            |
| `docs/UX-parcours.md` 🆕  | Personae, sidebars, parcours admin/client                    | `4bc6327`, `d46e0b0` |
| `docs/Brief.md` 🔧        | Cadrage (depuis remplacé par `Mission.md` + `Suivi.md`)      | `ece1b6a`            |
| `docs/Backlog.md` 🆕      | Ce document                                                  | `7d9d16b`            |

### Chantier 4 — Renommage `tickets` → `requests` (UI)

| Modif            | Détail                                                  | Commit    |
| ---------------- | ------------------------------------------------------- | --------- |
| Routes           | `/tickets` → `/requests` (table DB conservée)           | `5ea2c3c` |
| Composants       | `ticket-form/list/replies/status-control` → `request-*` | `5ea2c3c` |
| Navigation       | Sidebar, mobile-nav, dashboard CTA, support chat        | `9cc868c` |
| i18n             | Clés `requests.*` ajoutées, bell orphan retiré          | `4098f3b` |
| Page `/requests` | Réécrite — stats par statut                             | `5ea2c3c` |

### Chantier 5 — Modernisation UI (~13h budgétées, clôturé)

| Bloc                    | Apport                                                                                                                                     | Commit               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **A — Foundation**      | shadcn/ui (6 primitives) + sonner + `ConfirmProvider`/`useConfirm`. Button étendu (asChild + variants). 15+ alert/confirm natifs remplacés | `4cb05a3`, `4eaf7ef` |
| **B — Forms**           | react-hook-form + zod. 5 forms migrés. Schémas centralisés `lib/schemas/` 🆕                                                               | `834ec29`            |
| **C — Listes TanStack** | 📋 Reporté en E5/E6                                                                                                                        | —                    |
| **D — Charts**          | recharts + 3 wrappers Figma 🆕. Migration ga4-analytics                                                                                    | `9ff2c0b`            |
| **E — Finition E3**     | GBP + GSC migrés vers Recharts (5 charts), Insight Message dashboard 🆕, polish settings (Badge rôle, locale date)                         | (cette session)      |

### Volumes

| Métrique                         | Valeur                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Commits depuis `initial-fork`    | 41                                                                                                     |
| Fichiers retirés (modules figés) | ~50                                                                                                    |
| Migrations                       | 26 (drop modules gelés en `024`, `leads.connector` en `026`)                                           |
| Tables DB actives                | 13                                                                                                     |
| Deps retirées                    | `web-push`, `pdfkit`, libs Facebook, libs WordPress AI                                                 |
| Deps ajoutées                    | `react-hook-form`, `zod`, `@hookform/resolvers`, `recharts`, `sonner`, `radix-ui` (×6), `lucide-react` |

---

## F1 — Authentification & comptes

| ID   | Feature                     | Statut | Évol | Implémentation                                              | Notes                                             |
| ---- | --------------------------- | ------ | ---- | ----------------------------------------------------------- | ------------------------------------------------- |
| F1.1 | Login email/password        | ✅     | 🔧   | `app/(auth)/login/login-form.tsx` → `auth.ts::loginAction`  | Migré RHF + zod (Bloc B), toast sonner            |
| F1.2 | Mot de passe oublié         | ✅     | 🔧   | `(auth)/forgot-password/` → `auth.ts::forgotPasswordAction` | Migré RHF + zod, rate limit 1/15min               |
| F1.3 | Reset password (lien email) | ⚠️     |      | Flow Supabase + `auth/callback/route.ts`                    | Pas de page custom de saisie                      |
| F1.4 | Logout                      | ✅     |      | `header.tsx` → `supabase.auth.signOut()`                    | —                                                 |
| F1.5 | Acceptation invitation      | ✅     | 🔧   | `invite/[token]/` → `invites.ts::acceptInviteAction`        | Migré RHF + zod, split en 2 forms                 |
| F1.6 | Blocage compte brute-force  | ✅     |      | Migration `010_login_security` (`profiles.is_blocked`)      | Déblocage admin via `users.ts::unblockUserAction` |
| F1.7 | Audit last_login_at         | ✅     |      | `alerts.ts::updateLastLogin()`                              | Alimente alerte inactivité (F14.1)                |

## F2 — Profil utilisateur

| ID   | Feature                  | Statut | Évol | Implémentation                                               | Notes                                    |
| ---- | ------------------------ | ------ | ---- | ------------------------------------------------------------ | ---------------------------------------- |
| F2.1 | Voir mon profil          | ✅     |      | `(dashboard)/settings/page.tsx` → `profile.ts::getProfile()` | `React.cache()` pour dédup               |
| F2.2 | Modifier mon profil      | ✅     | 🔧   | `settings-form.tsx` → `updateProfileAction`                  | Migré RHF + zod (`profileUpdateSchema`)  |
| F2.3 | Changer mon mot de passe | ✅     | 🔧   | `settings-form.tsx` → `changePasswordAction`                 | Migré RHF + zod (`changePasswordSchema`) |
| F2.4 | Upload avatar            | ✅     |      | `avatar-upload.tsx` → `updateAvatarAction`                   | Supabase Storage bucket `avatars`        |
| F2.5 | Changer langue interface | ✅     |      | `language-switcher.tsx` → `updateLanguageAction`             | `en` / `fr-BE` / `ro` via i18n maison    |

## F3 — Gestion des clients (Admin)

| ID   | Feature                | Statut | Évol | Implémentation                                        | Notes                                                             |
| ---- | ---------------------- | ------ | ---- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| F3.1 | Liste des clients      | ✅     |      | `admin/clients/page.tsx` → `clients.ts::getClients()` | —                                                                 |
| F3.2 | Créer un client        | ✅     |      | `client-form.tsx` → `createClientAction`              | Champs : business_name, contact_email/phone, notes                |
| F3.3 | Détail client          | ✅     |      | `admin/clients/[id]/page.tsx` → `getClient(id)`       | Sections : info, contact, notes, websites, intégrations, activity |
| F3.4 | Modifier un client     | ✅     |      | `client-form.tsx` mode édition → `updateClientAction` | —                                                                 |
| F3.5 | Supprimer un client    | ✅     | 🔧   | `clients-list.tsx` → `deleteClientAction`             | Confirmation via `useConfirm()` 🆕                                |
| F3.6 | Notes admin sur client | ✅     |      | `admin-notes.tsx` → `updateClientNotesAction`         | Texte libre `clients.notes`                                       |
| F3.7 | Sélection client actif | ✅     |      | `client-switcher.tsx` → `selectClientAction`          | Header, admin multi-client                                        |

## F4 — Gestion des sites web (Admin)

| ID   | Feature                          | Statut | Évol | Implémentation                             | Notes                                                   |
| ---- | -------------------------------- | ------ | ---- | ------------------------------------------ | ------------------------------------------------------- |
| F4.1 | Liste de tous les sites          | ✅     |      | `admin/websites/page.tsx`                  | —                                                       |
| F4.2 | Détail d'un site                 | ✅     |      | `admin/websites/[id]/page.tsx`             | API key, webhook secret, infos clé/valeur, liens projet |
| F4.3 | Créer un site                    | ✅     |      | `website-form.tsx` → `createWebsiteAction` | Génère API key (UUID) + webhook secret (32 bytes)       |
| F4.4 | Modifier un site                 | ✅     |      | `updateWebsiteAction`                      | —                                                       |
| F4.5 | Activer/désactiver               | ✅     |      | `toggleWebsiteActiveAction`                | Coupe le webhook si inactif                             |
| F4.6 | Régénérer API key                | ✅     | 🔧   | `regenerateApiKeyAction`                   | Confirmation destructive via `useConfirm()` 🆕          |
| F4.7 | Supprimer un site                | ✅     | 🔧   | `deleteWebsiteAction`                      | Confirmation destructive 🆕                             |
| F4.8 | Liens projet (Git, Asana, Figma) | ✅     |      | `updateProjectLinkAction`                  | Migrations `012`, `013`                                 |
| F4.9 | Infos site (credentials, notes)  | ✅     |      | `lib/actions/website-info.ts` (CRUD)       | Migration `015`, masquage si sensitive                  |

## F5 — Utilisateurs & invitations (Admin)

| ID    | Feature                       | Statut | Évol | Implémentation                                      | Notes                                           |
| ----- | ----------------------------- | ------ | ---- | --------------------------------------------------- | ----------------------------------------------- |
| F5.1  | Liste des utilisateurs        | ✅     |      | `admin/users/page.tsx` → `getUsers()`               | Avec clients assignés, last_login, statut       |
| F5.2  | Créer un utilisateur direct   | ✅     |      | `user-form.tsx` → `createUserAction`                | Auth + profile + client_users + email bienvenue |
| F5.3  | Inviter par email             | ✅     |      | `createInviteAction`                                | Token 7j, email Resend                          |
| F5.4  | Lister invitations en attente | ✅     |      | `getPendingInvites()`                               | —                                               |
| F5.5  | Renvoyer invitation           | ✅     | 🔧   | `resendInviteAction`                                | Confirmation via `useConfirm()` 🆕              |
| F5.6  | Supprimer invitation          | ✅     | 🔧   | `deleteInviteAction`                                | Confirmation destructive 🆕                     |
| F5.7  | Modifier rôle utilisateur     | ✅     | 🔧   | `updateUserRoleAction`                              | Confirmation via `useConfirm()` 🆕              |
| F5.8  | Assigner à un client          | ✅     |      | `assignUserToClientAction`                          | Rôles : owner / viewer                          |
| F5.9  | Retirer d'un client           | ✅     |      | `removeUserFromClientAction`                        | —                                               |
| F5.10 | Admin reset password          | ✅     |      | `edit-user-modal.tsx` → `adminChangePasswordAction` | —                                               |
| F5.11 | Débloquer utilisateur         | ✅     | 🔧   | `unblockUserAction`                                 | Confirmation via `useConfirm()` 🆕              |
| F5.12 | Supprimer utilisateur         | ✅     | 🔧   | `deleteUserAction`                                  | Confirmation destructive 🆕                     |

## F6 — Réception et gestion des prospects (Leads)

| ID    | Feature                                | Statut | Évol | Implémentation                                                                                              | Notes                                                                                                                                        |
| ----- | -------------------------------------- | ------ | ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| F6.1  | Réception webhook lead                 | ✅     | 🔧   | `POST /api/webhooks/lead`                                                                                   | Devenu dispatcher mince en E4 ; side-effects réduits : push + Facebook retirés en E1                                                         |
| F6.2  | Détection multi-langue champs          | ✅     | 🔧   | `lib/leads/connectors/generic-webhook.ts`                                                                   | Extrait du route handler en E4 ; EN/RO/FR/NL/ES/DE/RU, compat Elementor/CF7/WPForms                                                          |
| F6.3  | Liste paginée leads                    | ✅     | 🔧   | `leads/page.tsx` → `getLeadsPaginated`                                                                      | E5 : recherche poussée en base (`ilike`, count+data), UI debounce, reset/clamp page                                                          |
| F6.4  | Détail d'un lead                       | ✅     |      | `leads/[id]/page.tsx` → `getLead(id)`                                                                       | Contact, message, raw_data, historique, notes                                                                                                |
| F6.5  | Changer status lead                    | ✅     |      | `lead-status.tsx` → `updateLeadStatusAction`                                                                | `new` → `contacted` → `done`                                                                                                                 |
| F6.6  | Notes sur un lead                      | ✅     |      | `lead-notes.tsx` → `addLeadNoteAction`                                                                      | Max 5000 chars, table `lead_notes`                                                                                                           |
| F6.7  | Supprimer un lead                      | ✅     | 🔧   | `deleteLeadAction`                                                                                          | Confirmation via toast 🆕                                                                                                                    |
| F6.8  | Badge nav leads new                    | ✅     |      | `nav-badges.ts::getNavBadgeCounts()`                                                                        | —                                                                                                                                            |
| F6.9  | Test webhook (GET)                     | ✅     |      | `GET /api/webhooks/lead?key=…`                                                                              | Renvoie statut config                                                                                                                        |
| F6.10 | Architecture pluggable des connecteurs | ✅     | 🆕   | `lib/leads/connectors/` (types, registry, `wordpress-form`, `generic-webhook`) + migration `026` + UI badge | Livré 2026-05-15. Interface `Connector` + capability `receive` (V1) + `reply` (interface posée, V2). Doc d'extension : `docs/Connecteurs.md` |
| F6.11 | Statut "Devenu client"                 | ✅     | 🔧   | Relabel d'affichage `leads.*` (enum DB inchangée)                                                           | E5 : liste/détail/dashboard, 3 langues                                                                                                       |

## F7 — Demandes (Requests, ex-Tickets)

> Table DB reste `tickets`, vocabulaire UI = "demande". Voir `docs/UX-glossaire.md`.

| ID   | Feature                                    | Statut | Évol | Implémentation                                                   | Notes                                                   |
| ---- | ------------------------------------------ | ------ | ---- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| F7.1 | Liste paginée demandes                     | ✅     | 🔧   | `requests/page.tsx` → `getTicketsPaginated`                      | Page réécrite avec stats Submitted/InProgress/Completed |
| F7.2 | Créer une demande                          | ✅     | 🔧   | `requests/new/request-form.tsx` → `createTicketAction`           | Migré RHF + zod (`requestCreateSchema`)                 |
| F7.3 | Détail d'une demande                       | ✅     | 🔧   | `requests/[id]/page.tsx` → `getTicket(id)`                       | Renommage tickets→requests                              |
| F7.4 | Répondre à une demande                     | ✅     | 🔧   | `request-replies.tsx` → `addTicketReplyAction`                   | Max 10k chars, note interne admin possible              |
| F7.5 | Changer status demande                     | ✅     | 🔧   | `request-status-control.tsx` → `updateTicketStatusAction`        | Set `closed_at` si fermée                               |
| F7.6 | Modifier priorité/cat/assignation/échéance | ✅     |      | `updateTicketAction`                                             | Admin uniquement                                        |
| F7.7 | Supprimer une demande                      | ✅     | 🔧   | `deleteTicketAction`                                             | Confirmation via `useConfirm()` 🆕, admin               |
| F7.8 | Chat widget support client                 | ✅     |      | `support-chat.tsx` → `getOrCreateChatTicket` + `getChatMessages` | Bulle flottante mobile-first                            |
| F7.9 | Badge demandes ouvertes (admin)            | ✅     |      | Lien `/requests?status=open` avec compteur                       | —                                                       |

## F8 — Google Analytics 4

| ID    | Feature                      | Statut | Évol | Implémentation                                      | Notes                                        |
| ----- | ---------------------------- | ------ | ---- | --------------------------------------------------- | -------------------------------------------- |
| F8.1  | OAuth Google GA4             | ✅     |      | `GET /api/auth/google?type=ga4` + callback          | Tokens chiffrés AES, refresh auto            |
| F8.2  | Sélection propriété GA4      | ✅     |      | `selectIntegrationAccount(...)`                     | Auto-sélection si une seule                  |
| F8.3  | Page Analytics               | ✅     | 🔧   | `analytics/page.tsx` → `fetchGA4Analytics`          | Charts migrés Recharts (Bloc D)              |
| F8.4  | Vue d'ensemble (5 KPIs)      | ✅     |      | sessions, users, pageViews, bounceRate, avgDuration | —                                            |
| F8.5  | Sessions journalières        | ✅     | 🔧   | `SiteLineChart` 🆕                                  | Recharts area chart, gradient teal           |
| F8.6  | Événements CTA personnalisés | ✅     | 🔧   | `SiteBarChart` horizontal 🆕                        | Hint setup `gtag('event', 'cta_click', ...)` |
| F8.7  | Événements auto-trackés      | ✅     |      | Liste top 8                                         | —                                            |
| F8.8  | Top pages                    | ✅     | 🔧   | `SiteBarChart` horizontal 🆕                        | Top 8 par pageViews                          |
| F8.9  | Sources de trafic            | ✅     | 🔧   | `SiteDonutChart` 🆕                                 | Channels avec %                              |
| F8.10 | Force refresh (bypass cache) | ✅     |      | Bouton header analytics                             | Cache 30 min sinon                           |

## F9 — Google Business Profile (GBP)

| ID   | Feature               | Statut | Évol | Implémentation                                    | Notes                                                                       |
| ---- | --------------------- | ------ | ---- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| F9.1 | OAuth Google GBP      | ✅     |      | `GET /api/auth/google?type=gbp`                   | Scope `business.manage`                                                     |
| F9.2 | Sélection emplacement | ✅     |      | Même `selectIntegrationAccount`                   | —                                                                           |
| F9.3 | Page Business Profile | ✅     |      | `business-profile/page.tsx` → `fetchGBPAnalytics` | Cache 30 min                                                                |
| F9.4 | Métriques GBP         | ✅     | 🔧   | views, calls, directions, website clicks          | Daily → `SiteLineChart`, breakdown → `SiteBarChart` horizontal (2026-05-14) |
| F9.5 | Keywords de recherche | ✅     | 🔧   | Top mots-clés avec count                          | Migré `SiteBarChart` horizontal (2026-05-14)                                |

## F10 — Google Search Console (GSC)

| ID    | Feature                | Statut | Évol | Implémentation                                  | Notes                                                                                            |
| ----- | ---------------------- | ------ | ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| F10.1 | OAuth Google GSC       | ✅     |      | `GET /api/auth/google?type=gsc`                 | Scope `webmasters.readonly`                                                                      |
| F10.2 | Sélection site         | ✅     |      | sc-domain ou URL                                | —                                                                                                |
| F10.3 | Page Search Console    | ✅     |      | `search-console/page.tsx` → `fetchGSCAnalytics` | —                                                                                                |
| F10.4 | Métriques GSC          | ✅     | 🔧   | clicks, impressions, CTR, position              | Daily → `SiteLineChart`, devices → `SiteDonutChart`, queries/pages → `SiteBarChart` (2026-05-14) |
| F10.5 | Top requêtes           | ✅     |      | query, clicks, impressions, CTR, position       | —                                                                                                |
| F10.6 | Top pages GSC          | ✅     |      | —                                               | —                                                                                                |
| F10.7 | Répartition par device | ✅     |      | DESKTOP / MOBILE / TABLET                       | —                                                                                                |

## F11 — Dashboard / Accueil

| ID    | Feature                 | Statut | Évol | Implémentation                           | Notes                                                                                             |
| ----- | ----------------------- | ------ | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| F11.1 | Page Overview (client)  | ✅     |      | `dashboard/page.tsx`                     | Stats leads, sites, récents 30j, chat widget                                                      |
| F11.2 | Vue admin globale       | ✅     |      | `admin/page.tsx`                         | Stats globales, quick actions, alertes client                                                     |
| F11.3 | Insight Message (carte) | ✅     | 🆕   | `dashboard/page.tsx` — bloc Spark + Link | Carte 7j entre stats et CTA, avec compteur non-contactés et lien `/leads?status=new` (2026-05-14) |

## F12 — Impersonation (Admin)

| ID    | Feature                | Statut | Évol | Implémentation                                 | Notes                          |
| ----- | ---------------------- | ------ | ---- | ---------------------------------------------- | ------------------------------ |
| F12.1 | Démarrer impersonation | ✅     |      | `impersonate.ts::startImpersonation(clientId)` | —                              |
| F12.2 | Bandeau impersonation  | ✅     |      | `components/impersonate-banner.tsx`            | Barre en haut + bouton quitter |
| F12.3 | Quitter impersonation  | ✅     |      | `stopImpersonation()`                          | —                              |

## F13 — Activity log / audit

| ID    | Feature                  | Statut | Évol | Implémentation                                             | Notes                                                                                                                                  |
| ----- | ------------------------ | ------ | ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F13.1 | Enregistrement immuable  | ✅     | 🔧   | Migration `005_activity_logs` + `activity.ts::logActivity` | E5 : `logActivity` était **inerte** (appelé nulle part) → branché dans toutes les mutations + metadata techniques. Insert-only via RLS |
| F13.2 | Historique par client    | ✅     | 🔧   | `getClientActivity(clientId)` + `activity-log.tsx`         | Détail client ; rendu **localisé** (action_type + metadata, en/fr-BE/ro)                                                               |
| F13.3 | Activité globale récente | ⚠️     |      | `getRecentActivity(limit?)`                                | Fonction OK mais **branchée à aucune page** (la carte dashboard a sauté à la refonte vue admin). Décision vue globale en suspens       |

## F14 — Alertes client (Admin)

| ID    | Feature               | Statut | Évol | Implémentation                       | Notes                         |
| ----- | --------------------- | ------ | ---- | ------------------------------------ | ----------------------------- |
| F14.1 | Utilisateurs inactifs | ✅     |      | `alerts.ts::getClientAlerts()`       | `last_login_at < now() - 14j` |
| F14.2 | Leads non contactés   | ✅     |      | Logique : `status='new'` ET 3+ jours | —                             |
| F14.3 | Intégrations cassées  | ✅     |      | Tokens expirés non-refreshables      | —                             |

## F15 — Intégrations Google OAuth

| ID    | Feature                         | Statut | Évol | Implémentation                                        | Notes                              |
| ----- | ------------------------------- | ------ | ---- | ----------------------------------------------------- | ---------------------------------- |
| F15.1 | Lister intégrations d'un client | ✅     |      | `integrations.ts::getIntegrationsForClient(clientId)` | Types : ga4, gbp, gsc              |
| F15.2 | Connecter une intégration       | ✅     |      | OAuth Google (F8.1/F9.1/F10.1)                        | Tokens chiffrés AES                |
| F15.3 | Sélectionner compte/propriété   | ✅     |      | `selectIntegrationAccount(...)`                       | —                                  |
| F15.4 | Déconnecter intégration         | ✅     | 🔧   | `deleteIntegration(integrationId)`                    | Confirmation via `useConfirm()` 🆕 |
| F15.5 | Refresh auto tokens             | ✅     |      | `lib/google.ts`                                       | Si `expires_at` proche             |
| F15.6 | Cleanup cache analytics         | ✅     |      | `GET /api/cron/cleanup-cache` (auth CRON_SECRET)      | Supprime > 24h                     |

## F16 — Communication client

| ID    | Feature                       | Statut | Évol | Implémentation                           | Notes                                           |
| ----- | ----------------------------- | ------ | ---- | ---------------------------------------- | ----------------------------------------------- |
| F16.1 | Email transactionnel (Resend) | ✅     |      | `lib/email.ts`                           | Templates : nouveau lead, bienvenue, invitation |
| F16.2 | Envoyer email manuel client   | ✅     |      | `email.ts::sendEmailToClientAction(...)` | Side-effect : activity log                      |
| F16.3 | Chat widget support           | ✅     |      | Voir F7.8                                | —                                               |

## F17 — Webhooks externes

| ID    | Feature                 | Statut | Évol | Implémentation | Notes                                            |
| ----- | ----------------------- | ------ | ---- | -------------- | ------------------------------------------------ |
| F17.1 | Webhook entrant lead    | ✅     |      | Voir F6.1      | —                                                |
| F17.2 | Facebook Conversion API | 🗑️     | 🗑️   | Retiré en E1   | Pourrait revenir en E4 si besoin client confirmé |

## F18 — Navigation & UI globale

| ID    | Feature                    | Statut | Évol | Implémentation                                                        | Notes                                        |
| ----- | -------------------------- | ------ | ---- | --------------------------------------------------------------------- | -------------------------------------------- |
| F18.1 | Sidebar collapsible        | ✅     | 🔧   | `layout/sidebar.tsx` + `sidebar-context.tsx`                          | NAV_ITEMS nettoyés (modules retirés)         |
| F18.2 | Header + menu utilisateur  | ✅     |      | `layout/header.tsx`                                                   | Avatar, lang, theme, logout, client switcher |
| F18.3 | Navigation mobile          | ✅     | 🔧   | `layout/mobile-nav.tsx`                                               | Bottom nav, mis à jour pour requests         |
| F18.4 | Badges navigation          | ✅     |      | `nav-badges.ts::getNavBadgeCounts()`                                  | Leads new + requests open                    |
| F18.5 | Thème light/dark           | ✅     |      | `theme-provider.tsx` (maison, pas next-themes)                        | —                                            |
| F18.6 | i18n (EN/FR-BE/RO)         | ✅     |      | `lib/i18n/translations.ts` + `language-context.tsx`                   | Maison, pas next-intl                        |
| F18.7 | Toasts                     | ✅     | 🆕   | `sonner` + `Toaster` dans `app/layout.tsx`                            | Remplace alerts natifs                       |
| F18.8 | Confirmations destructives | ✅     | 🆕   | `components/ui/confirm-dialog.tsx` (`ConfirmProvider` + `useConfirm`) | Wrap Radix AlertDialog                       |

## F19 — Sécurité

| ID    | Feature                  | Statut | Évol | Implémentation                                       | Notes                                                                                                                                                                                                                                                        |
| ----- | ------------------------ | ------ | ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F19.1 | Row-Level Security (RLS) | ✅     | 🔧   | Migrations `001`+, `017`, `027`, `029`               | **Audit complet E6 (13 tables)** : lecture scopée partout, écritures CRM durcies (`027`), `activity_logs` INSERT scopé (`029`). Append-only activity_logs / lead_notes immuable / invites by-token confirmés intentionnels. ⚠️ `029` à exécuter sur Supabase |
| F19.2 | Rate limiting            | ✅     |      | `lib/rate-limit.ts` (sliding window in-memory)       | Webhook 30/60, login 5, forgot 1/15min, OAuth 10/min                                                                                                                                                                                                         |
| F19.3 | Sanitization input       | ✅     | 🔧   | Connecteur `generic-webhook` + route                 | Strip control chars, validation, troncature, 50KB max                                                                                                                                                                                                        |
| F19.4 | Encryption tokens Google | ✅     | 🔧   | AES-256-**GCM** via `crypto` Node (`lib/google.ts`)  | E6 : ex-AES-CBC fait-main → GCM authentifié (anti-falsification), clé dérivée+cachée, format `iv:tag:ct`. Pas de rétro-compat (projet de zéro)                                                                                                               |
| F19.5 | Security headers         | ✅     |      | `next.config.ts` (headers) ; middleware = `proxy.ts` | X-Content-Type-Options, X-Frame-Options, Referrer-Policy. E6 : `/api/cron` ajouté aux routes publiques du middleware (était redirigé vers /login)                                                                                                            |
| F19.6 | Audit deps               | ✅     | 🆕   | `pnpm audit` + override postcss                      | E6 : prod 25→0 vulns (next 16.2.9, postcss ≥8.5.10) ; `shadcn` CLI → devDeps (sortait hono/MCP-sdk du prod). Vulns restantes = dev-only                                                                                                                      |
| F19.7 | Health check             | ✅     |      | `GET /api/health`                                    | `{ status: "ok", timestamp }`                                                                                                                                                                                                                                |

## F20 — Modules retirés en E1 (traçabilité)

| Module                                                     | Raison du retrait                   | Surface supprimée                                                                         |
| ---------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| 🗑️ Reports PDF mensuels                                    | Hors scope MVP, complexité PDFKit   | `app/(dashboard)/reports/*`, `app/api/reports/*`                                          |
| 🗑️ Push notifications (web-push)                           | PWA non utilisée par persona Marie  | `app/api/push/*`, `lib/push.ts`                                                           |
| 🗑️ Tools admin (broken-links, SEO audit, uptime, security) | Hors scope MVP                      | `app/api/tools/*`, `app/(dashboard)/admin/tools/*`                                        |
| 🗑️ AI Settings / WordPress AI                              | Trop ambitieux pour pack 50h        | `app/api/wordpress/*`, `admin/ai-settings/*`, `lib/actions/wordpress*.ts`                 |
| 🗑️ Service worker / offline                                | Lié PWA                             | `public/sw.js`, `public/offline.html`, `app/manifest.ts`                                  |
| 🗑️ Facebook Conversion API                                 | Pas dans le scope MVP confirmé      | `lib/facebook.ts`                                                                         |
| 🗑️ Tables DB associées                                     | Migration `024_drop_frozen_modules` | `reports`, `push_subscriptions`, `site_checks`, `wordpress_*`, `website_change_detection` |

---

## Epics restants

| Epic                                           | Effort | Features liées                                                                        | Statut          |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------- | --------------- |
| E3 finition UI                                 | ~4h    | F9.4, F9.5, F10.4, F11.3, polish settings                                             | ✅ (2026-05-14) |
| E4 — Découplage leads (connecteurs pluggables) | 6h     | F6.10 ✅ (`leads.connector` + registry, livré 2026-05-15)                             | ✅              |
| E5 — Stabilisation CRM                         | 6h     | F6.3/F6.11 (recherche, devenu client), F13 (activity log), pagination, RLS CRM        | ✅ (2026-06-16) |
| E6 — Qualité & sécurité                        | 6h     | F19.1 (RLS), F19.4 (GCM), F19.6 (audit deps), edge cases auth (cron fix), lint propre | ✅ (2026-06-16) |

## Compteurs

| Catégorie               | Count                         |
| ----------------------- | ----------------------------- |
| Fonctionnelles (✅)     | ~99                           |
| Avec dette (⚠️)         | 4                             |
| Planifiées (📋)         | 3                             |
| Retirées (🗑️)           | 7 (cf. F20)                   |
| 🆕 Ajouts depuis fork   | 13 features + 4 docs + 6 deps |
| 🔧 Refactor depuis fork | 24 features                   |

## Conventions de mise à jour

| Règle | Détail                                                                         |
| ----- | ------------------------------------------------------------------------------ |
| 1     | À chaque commit qui ajoute/modifie une feature, mettre à jour son statut       |
| 2     | Quand 📋 → ✅, ajouter date dans colonne "Notes"                               |
| 3     | Quand une dette est résolue, ⚠️ → ✅ et retirer la mention en "Notes"          |
| 4     | Ne pas supprimer les 🗑️ — évite de re-coder ce qui a été volontairement retiré |
| 5     | Marqueurs 🆕 / 🔧 figés sur la durée de la mission (relatif à `initial-fork`)  |

## Voir aussi

| Doc                    | Rôle                                                |
| ---------------------- | --------------------------------------------------- |
| `docs/Mission.md`      | Cadrage stratégique (périmètre, objectifs)          |
| `docs/Suivi.md`        | Avancement, prochaines étapes, décisions            |
| `docs/UX-glossaire.md` | Vocabulaire métier                                  |
| `docs/UX-parcours.md`  | Parcours utilisateur par persona                    |
| `CLAUDE.md`            | Référence technique (stack, structure, conventions) |
