# Suivi de mission — VSP

> **Le fichier vivant.** Où on en est, ce qui vient ensuite, le budget, les décisions.
> À mettre à jour à chaque chantier. Pour le détail par fonctionnalité : `Backlog.md`.
> Le cap (périmètre, objectifs) : `Mission.md`.

**Dernière mise à jour : 2026-06-16**

---

## État actuel — en bref

Le gros œuvre est fait : le périmètre est resserré (modules gelés supprimés),
l'UI refondue sur les maquettes, la stack modernisée, le système de leads
découplé, le **CRM stabilisé (E5)** et la **qualité/sécurité durcie (E6)**. **Reste le buffer** (tests e2e, doc de déploiement).

- ✅ **E1 Hygiène** · ✅ **E2 Audit UX** · ✅ **E3 Refonte UI** · ✅ **E4 Connecteurs** · ✅ **E5 CRM** · ✅ **E6 Qualité & sécurité**
- 📋 Buffer

> Repère git : tag `initial-fork` = projet reçu (~36k LOC).

---

## Budget (pack 50h)

> ⚠️ Les heures ci-dessous sont les **estimations** de la `Roadmap.md`, pas un
> relevé de temps réel. **À renseigner avec les heures réellement consommées**
> au fil de l'eau — c'est le rôle de ce tableau.

| Étape                               | Estimé | Statut     | Réel |
| ----------------------------------- | -----: | ---------- | ---: |
| E1 — Hygiène technique              |     4h | ✅ Fait    |    — |
| E2 — Audit UX & langage             |     4h | ✅ Fait    |    — |
| E3 — Refonte UI                     |    20h | ✅ Fait    |    — |
| E3 bis — Modernisation technique UI |   ~13h | ✅ Fait    |    — |
| E4 — Découplage leads (connecteurs) |     6h | ✅ Fait    |    — |
| E5 — Stabilisation CRM              |     6h | ✅ Fait    |    — |
| E6 — Qualité & sécurité             |     6h | ✅ Fait    |    — |
| Buffer (tests e2e, doc déploiement) |     4h | 📋 À faire |    — |

> **Note budget** : E3 bis (~13h de modernisation : shadcn, react-hook-form+zod,
> recharts) a été ajouté en cours de route au-delà des 50h initiales. Impact à
> communiquer/valider avec Antoine + le client. Décision du 2026-05-13.

---

## Détail des étapes

### ✅ E1 — Hygiène technique

- Outillage : oxlint + oxfmt, `pnpm typecheck`, script `pnpm check`. Migration npm → pnpm.
- **Modules gelés supprimés** (code + tables, migration `024`) : WordPress IA, rapports PDF, PWA, push, Facebook Conversion API, outils admin. Voir `Backlog.md` §F20.

### ✅ E2 — Audit UX & langage client

- Cartographie des parcours admin/client → `UX-parcours.md`.
- Glossaire anti-jargon → `UX-glossaire.md`.

### ✅ E3 — Refonte UI (+ E3 bis modernisation)

- Design system des maquettes, 6 écrans client + écrans complémentaires.
- Renommage `/tickets` → `/requests` (table DB `tickets` conservée).
- Modernisation : shadcn/ui (Radix), `sonner` + `useConfirm()` (fini les `alert()`/`confirm()` natifs), react-hook-form + zod (`lib/schemas/`), recharts (`components/charts/`).
- Insight Message sur le dashboard.
- **Reporté** : migration des 4 listes vers `@tanstack/react-table` (bloc C) → décalé en E5/E6.

### ✅ E4 — Découplage des leads

- Architecture pluggable : interface `Connector` + registry + capability `receive` (la capability `reply` est _posée_ mais pas implémentée — V2).
- Connecteurs livrés : `wordpress-form` (Elementor/CF7/WPForms) + `generic-webhook` (fallback multi-langue). Migration `026` (`leads.connector`).
- La route webhook est devenue un dispatcher mince. Doc d'extension : `Connecteurs.md`.

### ✅ E5 — Stabilisation CRM

**Lot A — bugs & edge cases** _(2026-06-16)_

- [x] Statut **« devenu client »** : `done` → « Devenu client », `new` → « À contacter » (3 langues, liste + détail + dashboard). Enum DB inchangée. Le détail lead (`lead-status`) et le dashboard (`recent-leads`) étaient codés en dur en anglais → corrigés. _(initial 2026-06-09, étendu A3)_
- [x] Pagination CRM à **10/page** + reset page sur recherche/filtre + clamp d'une page hors limites (leads, requests, admin/tickets).
- [x] **Recherche poussée en base** (leads + demandes) : avant, le `search` filtrait seulement la page courante et faussait le total. Désormais `ilike` côté SQL (count + data), UI câblée à l'URL en debounce. Recherche demandes inclut `#numéro` + nom de client.
- [x] Filtres demandes admin (multi-select statut, défaut « tous sauf fermé », tri, date relative+absolue) vérifiés ; **filtre par client** ajouté sur `/admin/tickets`.

**Lot B — nettoyage** _(2026-06-16)_

- [x] Code mort (`selected-client.ts` déjà retiré, réf. périmée CLAUDE.md), warnings lint CRM (5 → 2 ; les 2 restants sont des `__` intentionnels).

**Lot C — activity log** _(2026-06-16)_

- [x] `logActivity()` n'était **appelé nulle part** → branché dans toutes les mutations (lead statut/note, demande créée/répondue/statut, client, site, user assigné/retiré, intégration, email, + `lead_created` webhook). Metadata enrichie d'identifiants techniques (debug). Rendu **localisé** (en/fr-BE/ro) depuis `action_type` + metadata.

> ⚠️ **Actions manuelles en attente** (pas de prod : à passer sur ton Supabase de dev) : exécuter `027_crm_rls_hardening.sql` (durcissements RLS écriture), `028_ticket_numbers.sql` (numéros de demandes) et `029_activity_logs_rls_hardening.sql` (scope INSERT activity_logs).
>
> 🟡 **Décision en suspens** : vue **globale** admin de l'activity log (carte dashboard ou page `/admin/activity`) — la vue **par client** existe déjà (fiche client → Activité).

### ✅ E6 — Qualité & sécurité

- [x] Audit RLS **complet** (les 13 tables) _(2026-06-16)_. Verdict : sain (lecture scopée partout, `027` avait durci le CRM). 1 vrai trou : `activity_logs` INSERT acceptait n'importe quel `client_id` → corrigé par la migration **`029`** (scope `is_admin()` / clients de l'utilisateur / null). Append-only de `activity_logs` + immuabilité de `lead_notes` + `invites` invite-by-token confirmés intentionnels (documentés dans `029`).
- [x] **Chiffrement tokens Google** _(2026-06-16)_ : remplacé l'AES-CBC fait-main par **AES-256-GCM** (authentifié) via le `crypto` de Node — clé dérivée une fois (cache), format `iv:tag:ciphertext` (base64). Pas de rétro-compat (projet repris de zéro, aucun chiffré existant). Round-trip + détection de falsification vérifiés. (Vault écarté : mal taillé pour des tokens, couplage Supabase.)
- [x] **`pnpm audit` + deps + lint** _(2026-06-16)_ : prod **25 → 0 vulnérabilité** (next `16.1.6`→`16.2.9` ; override `postcss ^8.5.10` car next embarquait 8.4.31) ; **`shadcn` (CLI) déplacé en devDependencies** — il traînait tout `@modelcontextprotocol/sdk`/`hono` dans le graphe **prod**. 2 warnings lint (`__dirname`, `__resetConnectorsForTests`, légitimes) autorisés via `.oxlintrc.json`. `pnpm check` + build prod OK. _(vulns restantes = dev-only, CLI non livrée.)_
- [x] **Edge cases auth** _(2026-06-16)_ : session (getUser + refresh SSR), impersonation (gardes admin + vérif client + cookie purgé si perte de rôle, jamais honoré pour un non-admin), brute-force/déblocage (bien câblés dans loginAction) — tous vérifiés sains. **Bug corrigé** : `/api/cron/cleanup-cache` était redirigé vers `/login` par le middleware (absent des routes publiques) → cron cassé ; ajouté aux routes publiques (auth propre via `CRON_SECRET`).
- [x] Refactor « ai-slop » : traité au fil de E5/E6 (statuts i18n, Select, code mort, activity log). Pas de zone résiduelle identifiée.

### 📋 Buffer

- [ ] Tests manuels e2e sur les parcours critiques.
- [ ] Doc de déploiement (variables d'env, migrations, Vercel).

---

## Prochaine action

**Buffer** — dernier chantier avant livraison : tests manuels e2e des parcours
critiques + **doc de déploiement** (variables d'env, ordre des migrations, Vercel,
cron). Exécuter aussi les migrations `027`/`028`/`029` sur le Supabase de dev.

---

## Points ouverts (à débloquer si bloquants)

| Sujet                                                                | État                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Maquettes manquantes (GBP, Settings, forgot-password, invite, admin) | Improvisées sur le design system, sauf demande contraire        |
| Layout « Classements Google » (header horizontal ?)                  | À confirmer avec Jessie ; défaut = sidebar + grille horizontale |
| Dépassement budget dû à E3 bis (~13h)                                | À valider avec Antoine + client                                 |

---

## Journal des décisions

> Une ligne par décision structurante. La plus récente en haut.

| Date       | Décision                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-16 | E6 clôturé : audit RLS complet (13 tables) + migration `029` (activity_logs INSERT scopé) ; tokens Google en AES-256-GCM authentifié ; `pnpm audit` prod 25→0 (next 16.2.9, `shadcn` CLI sorti du prod, override postcss) ; edge cases auth vérifiés + fix du cron `/api/cron` redirigé vers /login. Lint 0 warning, build prod OK.                                                                              |
| 2026-06-16 | E5 clôturé (lots A/B/C) : recherche CRM en base, pagination robuste, statuts i18n cohérents, nettoyage, et activity log enfin fonctionnel (logActivity branché partout + rendu i18n). Parenthèse UI au passage : espaces agence/client via impersonate (bouton « ouvrir un espace client » sur l'accueil admin, retiré de la sidebar), filtre client sur `/admin/tickets`, Select assaini (popper, style Input). |
| 2026-06-09 | E5 audit RLS CRM : lecture confirmée saine, 3 écarts d'écriture (leads UPDATE sans WITH CHECK, auteur usurpable sur tickets/ticket_replies INSERT) corrigés via migration `027` (à exécuter sur Supabase).                                                                                                                                                                                                       |
| 2026-06-09 | E5 Batch 1 : pagination CRM 10/page + relabel statuts leads (« À contacter » / « Devenu client ») sans toucher l'enum DB.                                                                                                                                                                                                                                                                                        |
| 2026-06-09 | Refonte de la documentation : suppression des docs obsolètes (INTRO pré-audit), réécriture de `CLAUDE.md`/`README`, création de `Mission.md` + `Suivi.md` + index `docs/README.md`. Objectif : une suite de docs à jour, sans contradiction avec le code.                                                                                                                                                        |
| 2026-05-15 | E4 livré : connecteurs pluggables (`wordpress-form` + `generic-webhook`), `leads.connector`.                                                                                                                                                                                                                                                                                                                     |
| 2026-05-14 | E3 finition + Insight Message dashboard.                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-13 | Ajout de E3 bis (modernisation technique UI ~13h) plutôt que d'accumuler la dette. Impact budget à valider.                                                                                                                                                                                                                                                                                                      |
| —          | `tickets` → `requests` (UI) ; table DB conservée.                                                                                                                                                                                                                                                                                                                                                                |
| —          | Statuts leads : garder l'enum, ne traduire que l'affichage (pas de migration).                                                                                                                                                                                                                                                                                                                                   |
| —          | Pas de couche « origin marketing » (UTM) au MVP — les connecteurs ≠ tagging marketing.                                                                                                                                                                                                                                                                                                                           |

---

## Conventions de mise à jour

1. À chaque chantier terminé : cocher les cases, passer le statut, dater le journal.
2. Renseigner les **heures réelles** dans le tableau budget (sinon il ne sert à rien).
3. Une décision structurante (scope, archi, budget) → une ligne dans le journal.
4. Le statut _par fonctionnalité_ va dans `Backlog.md`, pas ici. Ici = la vue d'ensemble.
