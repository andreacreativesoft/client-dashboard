# Roadmap Pack 50h

> **Document contractuel figé** (proposition envoyée au client, 16/03/2026). Sert
> de référence au pack d'heures et à la subsidiation. Ne pas modifier : l'exécution
> réelle et son réordonnancement vivent dans `Suivi.md`.

---

## Identification

| Rédacteur         | Mathias Billot        |
| :---------------- | :-------------------- |
| **Nom du client** | VSP \- Votre Site Pro |
| **Projet**        | Dashboard Client      |
| **Date**          | 16/03/2026            |

## Table des matières

[1\. Structure de l’équipe de projet](#structure-de-l’équipe-de-projet)

[2\. Contexte](#contexte)

[3\. Calendrier prévisionnel](#calendrier-prévisionnel)

[4\. Spécifications techniques](#spécifications-techniques)

[Technologies et architecture](#technologies-et-architecture)

[Intégrations externes](#intégrations-externes)

[Estimation de la charge de travail](#estimation-de-la-charge-de-travail)

[Hébergement et maintenance](#hébergement-et-maintenance)

[5\. Hypothèses de travail](#hypothèses-de-travail)

---

1. ## Structure de l’équipe de projet {#structure-de-l’équipe-de-projet}

| _Composition de l'équipe côté client Rôles et responsabilités (Product Owner, Scrum Master, etc.) Méthodes de communication et fréquence des réunions_ |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- |

**Composition de l’équipe côté Orange Bleu :**

| Gestionnaire de projet           | Antoine Gowie              |
| :------------------------------- | :------------------------- |
| Développeur Back-end & Front-end | Mathias Billot & Ugo Porcu |
| UX/UI Designer                   | Jessie Fournie             |

**Composition de l’équipe côté client :**

| Chef de Projet |     |
| :------------- | :-- |

2. ## Contexte {#contexte}

Client Dashboard est une plateforme SaaS développée en Next.js/Supabase, destinée à offrir aux clients de l’agence web Votre Site Pro un tableau de bord centralisé sur leurs leads, analytics et présence en ligne.

Le projet a été initialement développé présente un périmètre fonctionnel large : leads, analytics GA4/GBP/GSC, outils SEO/uptime, rapports PDF, PWA, module WordPress, système de tickets.

L'objectif de cette intervention est de transformer ce prototype en un MVP prêt pour la production, en recentrant le produit sur ses fonctionnalités essentielles (dashboard, leads, analytics), en gelant les modules secondaires (rapports PDF, PWA, IA WordPress), et en adaptant l'interface à un public non-technique (commerçants, artisans) qui a besoin de comprendre ce que leur site web leur rapporte concrètement, sans jargon.

Le travail couvre la **refonte de l'UI** sur base de nouvelles maquettes, un **audit UX orienté accessibilité cognitive**, le **découplage du système de leads** pour supporter plusieurs sources d'acquisition, la **stabilisation du CRM**, et une **remise à niveau globale de la qualité du code** et de la **sécurité**.

3. ## Calendrier prévisionnel {#calendrier-prévisionnel}

| _Calendrier global : Définition du calendrier total du projet, incluant les dates de démarrage et de clôture. Échéances des livrables : Fixation des dates de livraison pour chaque livrable clé._ |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

_Les dates et durées ci-dessous sont sujettes à changements durant le projet suivant les considérations techniques._

| Calendrier prévisionnel                                                                                                |     |
| :--------------------------------------------------------------------------------------------------------------------- | :-- |
| Date de début de la Phase opérationnelle                                                                               |     |
| Durée de la Phase opérationnelle                                                                                       |     |
| Date approximative de début de la Phase de finalisation                                                                |     |
| _Les échéances intermédiaires seront définies précisément lors de chaque remise en accord avec les besoins du client._ |     |

4. ## Spécifications techniques {#spécifications-techniques}

### Technologies et architecture {#technologies-et-architecture}

| Environnement de développement back-end  | _NextJs & Supabase (auth)_ |
| :--------------------------------------- | :------------------------- |
| Environnement de développement front-end | _NextJs (React), Tailwind_ |
| Données                                  | _Supabase (DB)_            |

### Intégrations externes {#intégrations-externes}

| Intégration        | Solution envisagée   |                                                             |
| :----------------- | :------------------- | :---------------------------------------------------------- |
| Google APIs        | G4A \+ GBP \+ GSC    | Fonctionnalités à garder et stabiliser                      |
| Hébergement        | Vercel (et Supabase) |                                                             |
| Emailing           | Resend               |                                                             |
| Push notifications | web-push (VAPID)     | Fonctionnalités à geler/supprimer, car hors du scope du MVP |
| Génération PDF     | PDFKit               |                                                             |

### Estimation de la charge de travail {#estimation-de-la-charge-de-travail}

Cette section présente les grandes lignes du travail envisagé sur les 50 heures de prestation. Il s'agit d'une feuille de route indicative, pas d'un engagement contractuel sur chaque point : les heures sont des estimations, les priorités pourront être réajustées au fil de l'avancement, et certaines tâches pourront prendre plus ou moins de temps que prévu selon les réalités rencontrées en cours de route. L'objectif est de s'assurer qu'on partage la même vision de ce qui sera fait, dans quel ordre, et avec quels arbitrages, notamment sur les fonctionnalités qu'on choisit de geler pour concentrer l'effort sur un MVP solide et livrable.

| Désignation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |     | Estimation (h) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | :------------- |
| **P1 \- Setup & Hygiène technique** Configurer un formatter et un linter, formater l'ensemble du repo Ajouter typecheck, corriger les erreurs TypeScript existantes Supprimer le code des fonctionnalités gelées Module WordPress IA (10 fichiers lib, 8 routes API, 16 composants, 4 tables) Rapports PDF (PDFKit, lib/reports/, route API, composants) PWA (service worker, manifest, offline.html) Notifications push (web-push, lib/push.ts, composants) Intégration Facebook Conversion API                                                                                                                                                                                                                                                                   |     | 4              |
| **P2 \- Audit UX & Architecture de l'information** Cartographier les parcours admin vs client, simplifier les écrans et la navigation Élaborer un glossaire "langage client" : remplacer les termes techniques par des termes compréhensibles Proposer une architecture de navigation réduite à l'essentiel pour un public non-tech                                                                                                                                                                                                                                                                                                                                                                                                                                |     | 4              |
| **P3 \- Nouvelle UI** _Dépend de la livraison des maquettes par le client._ Design system : composants de base (boutons, cartes, inputs, badges, modales), tokens, typographie, palette (selon les maquettes fournies) Layout global : sidebar/header, navigation, responsivité Dashboard overview : page d'accueil avec stats clés, demandes récentes, vue d'ensemble Liste des demandes \+ détail : liste filtrable/paginée, page de détail avec notes, statut Analytics simplifié : statistiques de fréquentation et performance du site, présentées sans jargon Admin : gestion clients/sites : CRUD clients, sites web, utilisateurs, clés API Auth : login, mot de passe oublié, acceptation d'invitation Settings / profil : page de paramètres utilisateur |     | 20             |
| **P4 \- Découplage du système de leads** Transformer la normalisation des champs en un système de parsers pluggables (WordPress, Wix, formulaire générique, etc.) au lieu du système actuel fortement couplé aux champs WordPress Rendre le mapping des champs configurable par source/site, tout en gardant le webhook unique comme point d'entrée Documenter comment ajouter une nouvelle source d'acquisition de leads                                                                                                                                                                                                                                                                                                                                          |     | 6              |
| **P5 \- Stabilisation du CRM** Identifier et corriger les bugs / edge cases existants Améliorer la recherche, les filtres, la pagination Vérifier que les policies RLS sur leads, lead_notes et les tables liées sont correctes et complètes Nettoyage du code : refactor des notes, de l'activity log, suppression du code mort                                                                                                                                                                                                                                                                                                                                                                                                                                   |     | 6              |
| **P6 \- Qualité & Sécurité** Refactor "ai-slop" sur les parties touchées : nommage, abstractions inutiles, commentaires évidents, patterns incohérents, code dupliqué Audit RLS complet : vérifier chaque policy sur les 14+ tables vs le besoin réel Évaluer le remplacement de l'AES-256-CBC custom par une lib standard pour le chiffrement des tokens Google Valider les edge cases auth : expiration de session, impersonation, rate limiting du login, déblocage après blocage permanent Audit et upgrade des dépendances critiques, suppression des dépendances inutilisées (PDFKit, web-push, etc.)                                                                                                                                                        |     | 6              |
| Buffer pour retours (estimation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |     | 4              |
| **TOTAL**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |     | **50**         |

### Hébergement et maintenance {#hébergement-et-maintenance}

L'application utilise Supabase Cloud (géré par le client) et Vercel. Aucun hébergement supplémentaire n'est requis côté Orange Bleu.

5. ## Hypothèses de travail {#hypothèses-de-travail}

Cette proposition ne s'accompagne pas d'hypothèses de travail détaillées ni de spécifications fonctionnelles figées.  
Le projet en est à un stade où les contours exacts de chaque fonctionnalité restent à affiner : c'est d'ailleurs une partie du travail. C'est précisément pour cette raison que la prestation prend la forme d'un pack d'heures plutôt que d'un forfait au livrable : cela permet de s'adapter aux découvertes en cours de route, de réajuster les priorités si nécessaire, et de traiter les imprévus sans renégociations.  
En contrepartie, nous communiquerons régulièrement sur l'avancement, les choix faits, les difficultés rencontrées et le temps restant, afin de garder une visibilité partagée sur l'utilisation du budget.
