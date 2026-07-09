# Mission — VSP Client Dashboard

> Le cap de la prestation. Document stable, amendé seulement aux jalons.
> Avancement détaillé et décisions datées : `Suivi.md`. Contrat : `Roadmap.md`.

## 1. Le projet

**Votre Site Pro** (VSP) est une agence SEO/web (Pedro Soares) qui livre des
sites à des PME non-digitales. Elle dispose d'un dashboard client — développé
par un précédent prestataire — qui agrège les stats des sites. Le code était
**à moitié terminé, trop large et mal cadré** : c'est ce qui a fait perdre les
repères aux développeurs qui reprennent.

**La mission d'Orange Bleu** : transformer ce prototype en **MVP livrable**,
sous forme d'un **pack de 50h** (cf. `Roadmap.md`). Pas de périmètre figé au
livrable : un engagement sur un volume d'heures, avec communication régulière
sur l'avancement.

## 2. Objectif

> **Resserrer, simplifier le langage, stabiliser.** Pas d'ajout de fonctionnalités.

Le code reçu couvrait un périmètre énorme (~36 000 lignes). L'enjeu n'est pas de
construire plus, mais de **retirer** ce qui sort du MVP, **traduire** l'interface
pour un public non-technique, et **fiabiliser** les briques qui restent.

> **Cible utilisateur : Marie Dubois, restaurant Le Jardin.** Elle veut savoir si
> son site lui rapporte des clients. Pas plus. Elle n'ouvrira jamais un dashboard
> avec 15 KPI et 4 filtres.

## 3. Personae

| Rôle DB     | Persona                      | Ce qu'il fait                                                                                                                                |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`     | **Pedro** — agence VSP       | Gère tous les clients, sites, leads, intégrations. Vue globale. Travaille au desktop. Client de la mission **et** utilisateur du rôle admin. |
| `client`    | **Marie Dubois** — Le Jardin | Voit _ses_ prospects et stats, émet des demandes. Non-technique, mobile-first, se connecte 1–2×/semaine.                                     |
| _(externe)_ | **Sites WordPress**          | Envoient les leads via webhook. Pas d'identité en DB.                                                                                        |

> Orange Bleu (Mathias, Ugo — dev ; Jessie — UX ; Antoine — gestion) est le
> prestataire, pas un persona du produit.

## 4. Périmètre — ce qui est DANS le MVP

Six écrans client, définis par les maquettes (`maquette/`) :

| Écran                                       | Route               | Source de données         |
| ------------------------------------------- | ------------------- | ------------------------- |
| Accueil (« Bonjour Marie ! »)               | `/dashboard`        | Leads + GA4 + GBP agrégés |
| CRM (« Contacter les prospects »)           | `/leads`            | table `leads`             |
| Analyse du site                             | `/analytics`        | GA4                       |
| Classements Google                          | `/search-console`   | GSC                       |
| Google My Business                          | `/business-profile` | GBP                       |
| Assistance (« Demander des modifications ») | `/requests`         | table `tickets`           |

Plus les écrans **non maquettés mais nécessaires**, traités avec le design system
déduit des maquettes :

- **Espace admin** : clients, sites, utilisateurs, clés API, invitations, impersonation.
- **Settings / profil**, **login**, **mot de passe oublié**, **acceptation d'invitation**.

Le langage de toute l'UI client est régi par `UX-glossaire.md` (anti-jargon).

## 5. Périmètre — ce qui est HORS MVP (gelé)

Retiré du code et de la base en E1 (rien dans les maquettes n'y fait référence,
et c'est confirmé par le récap de réunion). **Ne pas re-coder.**

| Module gelé                                                     | Raison                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| Rapports PDF (PDFKit)                                           | Pedro a déjà SEMrush pour ça                              |
| Module WordPress IA (40 outils, SSH, mu-plugin)                 | Trop ambitieux, coûteux en tokens, hors priorité          |
| Notifications push (web-push/VAPID) + PWA                       | Remplacées par l'« Insight Message » du dashboard + email |
| Facebook Conversion API                                         | Hors scope MVP                                            |
| Outils admin (broken-links, SEO audit, uptime, security checks) | Hors scope MVP client                                     |

Traçabilité technique des suppressions : `Backlog.md` §F20.

## 6. Les cinq chantiers (vue d'ensemble)

Découpage des 50h (détail et statut dans `Suivi.md`) :

1. **E1 — Hygiène technique** : outillage (lint/format/typecheck/CI), suppression des modules gelés.
2. **E2 — Audit UX & langage client** : cartographie des parcours, glossaire anti-jargon.
3. **E3 — Refonte UI** : design system des maquettes, 6 écrans client + écrans complémentaires, modernisation technique (shadcn, rhf+zod, recharts).
4. **E4 — Découplage des leads** : architecture pluggable de connecteurs (cf. `Connecteurs.md`).
5. **E5 — Stabilisation CRM** & **E6 — Qualité & sécurité** : edge cases, audit RLS, statut « devenu client », nettoyage, audit des dépendances.

## 7. Décisions de cadrage actées

- **Tickets → « demandes »** : la table DB reste `tickets`, l'UI dit « demande ». Statuts exposés au client : Soumis / En cours / Terminé (les 4 statuts DB sont conservés).
- **Statuts leads** : on garde l'enum technique `new | contacted | done` et on ne change que l'affichage (« À contacter / Contacté / Devenu client »). Pas de migration de données risquée. Le statut « devenu client » reste un **flag simple** (pas de date/montant).
- **Connecteurs ≠ origine marketing** : la colonne « Source » du CRM identifie le **système d'origine** du lead (le connecteur), pas un tag UTM. Pas de couche « origin marketing » au MVP.
- **Insight Message remplace les notifications** : un message dynamique sur le dashboard (« Votre site vous apporte des clients ») tient lieu de centrale de notifications.
- **Pagination CRM** : 10 par page (aligné maquette), pas de filtres avancés.

## 8. Points encore ouverts

À arbitrer avec le client / Jessie quand ils deviennent bloquants (sinon : on
improvise sur le design system) :

- Maquettes manquantes : Google My Business, Settings, mot de passe oublié, acceptation d'invitation, espace admin.
- Layout « Classements Google » : header horizontal voulu, ou variation de design ? (recommandation : garder la sidebar, adopter la grille horizontale).

> Le suivi de ces points et leur résolution est journalisé dans `Suivi.md`.

## 9. Risques connus

| Risque                                                                       | Mitigation                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 20h pour l'UI trop juste avec les écrans non maquettés                       | Prioriser les 6 écrans maquettés ; improviser le reste sur le design system |
| Dépendances cachées des modules gelés                                        | Suppression progressive avec `pnpm typecheck` à chaque retrait              |
| Scope creep sur les « demandes » (réintégration assignation/chat/catégories) | S'aligner sur la version simplifiée avant de toucher                        |
| **Aucun test automatisé sur ~36k LOC**                                       | Hors scope MVP — à documenter, recommander un pack de suivi                 |
