# Glossaire UX — langage client

> Document d'arbitrage des termes utilisés dans l'interface, à destination du public final (commerçants, artisans — Marie Dubois, restaurant Le Jardin).
> Source : annotations des maquettes (`docs/maquette/*-note.svg`) + `Mission.md`.
> Vivant : amender au fil de l'implémentation.

---

## Règles d'écriture

1. **Pas de jargon technique.** Si un terme n'est pas immédiatement compréhensible par un non-tech, on le remplace.
2. **Phrases parlées, pas étiquettes.** "Personnes visitant votre site" plutôt que "Sessions".
3. **Positif et concret.** "Plus de gens vous trouvent" plutôt que "Augmentation des impressions".
4. **Pas de chiffres bruts sans contexte.** Toujours associer à une comparaison ("+15% par rapport au mois dernier") ou à une qualification ("fonctionne bien", "tout va bien").
5. **"Vous / votre"** systématique. Marie doit se sentir adressée directement.
6. **Tendances en mots doux** : "Stable", "En légère baisse" (jamais "négatif", "mauvais", "perte").

---

## 1. Navigation principale

| Actuel (code)                             | Cible (maquette)       | Commentaire                                                                    |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `nav.overview` "Aperçu"                   | **Accueil**            | Plus parlé, déjà dans la maquette                                              |
| `nav.leads` "Prospects"                   | **CRM**                | Garde le label maquetté ; le mot "prospects" reste OK dans les titres internes |
| `nav.google_analytics` "Google Analytics" | **Analyse du site**    | Marie n'a aucune idée de ce qu'est "Google Analytics"                          |
| `nav.search_console` "Search Console"     | **Classements Google** | Plus parlé, plus concret                                                       |
| `nav.google_business` "Google Business"   | **Google My Business** | OK                                                                             |
| `nav.tickets` "Tickets"                   | **Assistance**         | "Tickets" est du jargon support                                                |

---

## 2. Statuts des prospects (CRM)

**Décision (vs §6 question 2 du brief) :** 3 statuts, le 3e étant **"Devenu client"** sans champ "date / montant" obligatoire (flag simple).

| Actuel (DB / code)     | Cible UI          | DB enum                                          |
| ---------------------- | ----------------- | ------------------------------------------------ |
| `new` "Nouveau"        | **À contacter**   | `new` → renommer ? voir §Stockage                |
| `contacted` "Contacté" | **Contacté**      | `contacted`                                      |
| `done` "Terminé"       | **Devenu client** | `done` → renommer en `customer` ? voir §Stockage |

**Stockage** : on peut soit changer les valeurs enum (`new → to_contact`, `done → customer`), soit garder l'enum technique et ne changer que l'affichage. Recommandation : **garder l'enum, ne changer que la traduction**, pour éviter une migration de données risquée. À traiter en E5.

**Annotation maquette CRM** : "Show real people contacting the business — make value tangible ('these are my customers')". Le label "Devenu client" est l'expression directe de cette intention.

---

## 3. Source des prospects (connecteur d'origine)

**Annotation maquette CRM** : "Source (Google, Facebook, etc.)" affichée dans le tableau.
**Annotation maquette Dashboard** : "Source Breakdown (VERY SIMPLE) : Google / Facebook / Other".

**Interprétation produit** : cette colonne identifie **le système externe qui a fourni le lead** (le « connecteur » côté code). Ce n'est _pas_ un tagging marketing (UTM Google Ads / Facebook Ads) — qui n'est pas une feature du produit.

| Connecteur (slug DB) | Libellé UI           | Quand                                                                                 |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `wordpress-form`     | **Site web**         | Lead reçu via le formulaire du site WordPress du client (Elementor, WPForms, CF7…)    |
| `generic-webhook`    | **Site web**         | Fallback quand le payload ne ressemble à aucun système connu                          |
| `facebook-lead-ads`  | **Facebook** _(V2)_  | _Lead Ads Facebook_ — non implémenté en V1                                            |
| `instagram-dm`       | **Instagram** _(V2)_ | _Message direct Instagram_ — non implémenté en V1                                     |
| `gbp-message`        | **Google** _(V2)_    | _Google Business Profile message_ — non implémenté en V1                              |
| _(à venir)_          | …                    | Ajout d'un connecteur = 1 fichier + 1 ligne registry — cf. `docs/Connecteurs.md` (E4) |

V1 (E4) ne livre que `wordpress-form` + `generic-webhook` réellement branchés. Les libellés UI ci-dessus pour les V2 sont posés pour anticiper la cohérence avec la maquette.

Cadrage architectural complet : `docs/Connecteurs.md`.

---

## 4. Statuts des demandes (Assistance)

**Annotation maquette** : "List of requests: Submitted / In progress / Completed".

| Actuel (DB)         | Cible UI                        |
| ------------------- | ------------------------------- |
| `open`              | **Soumis**                      |
| `in_progress`       | **En cours**                    |
| `waiting_on_client` | _(à fusionner avec "En cours")_ |
| `closed`            | **Terminé**                     |

**Recommandation** : afficher seulement 3 statuts à l'utilisateur final, mais **conserver les 4 en DB** (l'admin peut avoir besoin de "Waiting on client" en interne). Mapping :

- `open` → "Soumis"
- `in_progress` ∪ `waiting_on_client` → "En cours"
- `closed` → "Terminé"

L'annotation insiste : "Keep everything minimal and easy to use" — donc pas de priorité visible côté client (la maquette montre un dropdown "Normale" / défaut, donc priority reste en DB mais probablement pas vraiment exposée).

---

## 5. Tableau de bord (Accueil)

### Cards top — KPIs

**Annotation maquette** : "Immediate clarity + value. 'Is this working for me?'"

| Donnée                    | Libellé UI                                                                   | Source                            |
| ------------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| Statut du site (UP/DOWN)  | **LIVE** + "Statut du site web" + message _"Votre site web fonctionne bien"_ | À implémenter ; check HTTP simple |
| Visiteurs ce mois         | **Visiteurs ce mois** + "+X% par rapport au mois dernier"                    | GA4 sessions                      |
| Note Google (étoiles GBP) | **Note Google** + "Basée sur X avis"                                         | GBP rating                        |

### Insight Message (remplace les notifications)

**Annotation maquette** : "Dynamic message like 'Your website is bringing you customers', 'You're getting more visitors this month', 'Everything is running smoothly'. **This replaces notifications.**"

Cohérent avec la suppression des push notifications (Phase 1 ✅).

| Cas                    | Message FR                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| Trafic +X% MoM         | "Vous obtenez plus de visiteurs ce mois 👍"                             |
| Nouveaux leads ce mois | "Votre site vous apporte des clients"                                   |
| Stable                 | "Tout fonctionne correctement"                                          |
| GBP avis ↑             | "Votre note Google s'améliore"                                          |
| Baisse de trafic       | "Votre trafic est en légère baisse — pas de panique, on peut en parler" |

### Help Banner

**Annotation maquette** : "Appears only when relevant."

| Déclencheur                   | Texte                                | CTA                                 |
| ----------------------------- | ------------------------------------ | ----------------------------------- |
| Toujours visible (par défaut) | "Besoin d'aide ou d'améliorations ?" | "Demander des modifs" → `/requests` |
| Pas de lead depuis 30j        | "Pas assez de prospects ?"           | "Contactez-nous"                    |
| Site marqué DOWN              | "Votre site semble inaccessible"     | "Voir le détail"                    |

---

## 6. Analytics — Analyse du site

**Annotations clés** :

- "Show performance clearly. No deep filtering. No technical metrics."
- "Use plain language like 'People visiting your website'. Avoid complex graphs or filters."

| Métrique GA4 actuelle | Libellé UI cible                                                         |
| --------------------- | ------------------------------------------------------------------------ |
| `Sessions`            | **Personnes visitant votre site web**                                    |
| `Users` (uniques)     | _(à fusionner avec sessions — Marie ne distingue pas)_                   |
| `Page Views`          | _(masquer du dashboard principal)_                                       |
| `Bounce Rate`         | _(masquer — Marie ne sait pas interpréter)_                              |
| `Avg Duration`        | **Temps moyen sur votre site**                                           |
| `Top Pages`           | **Vos pages les plus populaires**                                        |
| `Traffic Sources`     | **D'où viennent vos visiteurs**                                          |
| `Organic Search`      | **Recherche Google**                                                     |
| `Social`              | **Réseaux sociaux**                                                      |
| `Direct`              | **Direct** (OK)                                                          |
| `Referral`            | _(fusionner avec "Autre")_                                               |
| `CTA / Custom Events` | **Personnes qui vous ont contacté** (uniquement si conversion explicite) |

### Cards top (4 KPIs - maquette Analytics)

1. **Personnes visitant votre site web** ↑+12% de plus que le mois dernier
2. **Personnes qui vous ont contacté** (leads via formulaire)
3. **Temps moyen sur votre site** (+15 secondes de plus)
4. **Visiteurs devenus prospects** (taux de conversion en mots simples : nb_leads / sessions × 100, affiché +0,2%)

### États (annotation)

- Normal data
- No data yet → message d'accueil "Patientez quelques jours, on collecte vos données"
- Growing trend → ↑ vert
- **Declining trend (soft wording)** → ↓ + message neutre, jamais alarmiste
- Loading

---

## 7. Classements Google (Search Console + Local)

**Annotations clés** :

- "Combine SEO + local visibility."
- "Avoid any SEO jargon. Keep it positive and easy to understand."

| Métrique GSC actuelle             | Libellé UI cible                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `Total Clicks` / `Organic Clicks` | **Personnes qui vous ont trouvé grâce à la recherche**                                       |
| `Total Impressions`               | **Des personnes ont trouvé votre entreprise en ligne** (affichées dans les résultats Google) |
| `Average CTR`                     | _(masquer — abstrait)_                                                                       |
| `Avg Position`                    | _(masquer — abstrait ; remplacer par "visibilité augmente / stable / en baisse")_            |
| `Top Keywords` / `Top Queries`    | **Ce que les gens recherchent pour vous trouver**                                            |
| `Devices` (mobile/desktop)        | _(masquer du dashboard, garder admin)_                                                       |

### Cards top (4 KPIs - maquette GSC)

1. **Des personnes ont trouvé votre entreprise en ligne** (Total Impressions)
2. **Personnes qui vous ont trouvé grâce à la recherche** (Organic Clicks)
3. **Temps passé à apprendre à vous connaître** (Avg session duration from Search)
4. **Clients devenus intéressés** (Click-through rate exprimé en "% de personnes intéressées par ce qu'elles voient")

### Bandeau "Excellentes nouvelles !"

Si trend ↑ sur la période : message d'encouragement explicite.
Exemple : _"Voici les bonnes nouvelles : 15% de personnes en plus et 6% de demandes supplémentaires par rapport au mois dernier"_

### États (annotation)

- Improving
- Stable
- **Slight drop (soft message)** — par ex. _"Une légère baisse cette semaine, c'est normal"_
- No data yet

---

## 8. Google My Business

⚠️ **Pas de maquette fournie.** À improviser sur le UI Kit déduit des maquettes Analytics + GSC.

Vocabulaire suggéré (cohérent avec les autres écrans) :

| GBP actuel                  | Libellé UI cible                         |
| --------------------------- | ---------------------------------------- |
| `Direction Requests`        | **Demandes d'itinéraire**                |
| `Call Clicks`               | **Appels téléphoniques**                 |
| `Website Clicks`            | **Clics vers votre site**                |
| `Total Interactions`        | **Interactions totales**                 |
| `Search / Maps Impressions` | **Apparitions sur Google / Maps**        |
| `Search Keywords`           | **Mots-clés utilisés pour vous trouver** |
| `Rating`                    | **Note Google** (étoiles + "X avis")     |

---

## 9. Authentification

**Annotation maquette Login** : "Email + password login, Forgot password". Vocabulaire déjà conforme dans la maquette :

- "Bienvenue" / "Connectez-vous à votre espace personnel"
- "Adresse e-mail" / "Mot de passe"
- "Remember me" → préférer **"Se souvenir de moi"**
- "Mot de passe oublié ?"
- "Se connecter"
- "Besoin d'aide ? Contactez notre équipe"

---

## 10. Vocabulaire à bannir

À ne plus utiliser dans l'UI client :

- ~~Sessions, Users, Page Views, Bounce Rate~~ → cf. §6
- ~~CTR, CTA, Impressions, Conversion Rate~~ → expressions parlées
- ~~SEO, SEM, SEA, SERP, Backlink~~
- ~~API key, Webhook, Endpoint, Payload~~ → uniquement côté admin
- ~~Lead (en titre principal)~~ → **prospect** ou **client potentiel** dans le copy ; le mot "Leads" reste OK comme étiquette de KPI dans la maquette ("Leads totaux")
- ~~Ticket, Issue, Bug, Feature request~~ → **demande**
- ~~Pipeline, Funnel, Conversion funnel~~
- ~~Refresh, Sync, Cache miss~~

---

## 11. Questions ouvertes pour validation

1. **Statuts leads** : enum DB renommé (`new → to_contact`, `done → customer`) ou uniquement label affiché ? _(impact : migration vs simple traduction)_
2. **"Devenu client"** : flag simple, ou ajouter `customer_since_date` + `customer_value` plus tard ? _(par défaut : flag simple, à débattre avec client)_
3. **Bandeau "Excellentes nouvelles"** sur GSC : règle de déclenchement ? _(suggestion : impressions ↑ ≥ 10% MoM ET clics ↑ ≥ 5%)_
4. **Insight Message dashboard** : règles de priorisation si plusieurs messages applicables ? _(suggestion : 1 seul message visible, priorité = LIVE down > pas de lead 30j > baisse trafic > tendances positives)_
5. **Maquette GBP manquante** — improviser au design system ou demander un complément à Jessie ?
