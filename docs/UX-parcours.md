# Parcours UX — admin vs client

> Cartographie des parcours utilisateurs du Client Dashboard VSP.
> Deux rôles : **Admin** (équipe Votre Site Pro) et **Client** (commerçant / artisan — Marie Dubois, restaurant Le Jardin).
> Source : maquettes `docs/maquette/*` (côté client) + analyse du code existant (côté admin).

---

## 1. Personae

### Marie Dubois — propriétaire du Restaurant Le Jardin

- 45 ans, restauratrice
- N'a aucune notion de SEO, GA4, conversions, CTR
- Se connecte 1-2 fois par semaine, surtout depuis son téléphone
- Veut savoir : _"Est-ce que mon site marche ? Combien de clients ça m'amène ?"_
- N'ouvrira jamais un dashboard avec 15 KPIs et 4 filtres

### Pedro — équipe Votre Site Pro (admin)

- Gère 50-100 clients
- Crée les accès, configure les intégrations (GA4, GBP, GSC), traite les demandes de modif
- Travaille au desktop
- Veut : ajouter un client en 30 secondes, voir d'un coup d'œil les demandes ouvertes, impersonifier un client pour debug

---

## 2. Navigation cible

### Sidebar **client**

D'après la maquette Main page :

```
[Logo Votre Site Pro] + (sélecteur de site si plusieurs)

[●] Accueil
    Analyse du site
    Classements Google
    Google My Business
    Assistance
    CRM

────────────────
[Marie Dubois]
Restaurant Le Jardin
[↪] Déconnexion
```

### Sidebar **admin**

Pas maquettée — réutilise les sections existantes. Recommandation : garder une sidebar partagée + section "Admin" repliable en bas pour les pages agence.

```
[Logo VSP]

[●] Accueil (vue agence : tous clients confondus)
    Tous les prospects
    Toutes les demandes

──── ADMIN ────
    Clients
    Utilisateurs
    Sites web
```

**À ne PAS inclure dans la sidebar admin** (déjà supprimés en E1) :

- ~~Outils (broken-links, SEO, uptime, security)~~
- ~~Réglages IA~~
- ~~Rapports PDF~~

---

## 3. Parcours client

### 3.1 Premier login

1. Marie reçoit un email d'invitation (Resend, template `invite.tsx`)
2. Clic sur le lien → `/invite/[token]`
3. Définit son mot de passe → redirigée vers `/dashboard`
4. **Accueil** : voit immédiatement "Bonjour Marie !" + 3 KPI (LIVE, Visiteurs, Note Google) + bandeau aide
5. _Aucune popup d'onboarding intrusive_ — l'écran d'accueil EST le tutoriel (annotation maquette : "Immediate clarity + value")

**État "no data yet"** (premier login, données GA4 pas encore collectées) :

- KPIs affichent "—" + message _"On collecte vos données, revenez d'ici quelques jours"_
- CRM montre l'état empty avec : _"Personne ne vous a contacté pour le moment — dès qu'un message arrive, vous le verrez ici"_ (annotation maquette)

### 3.2 Routine hebdomadaire (cas le plus fréquent)

1. Marie ouvre l'app (PWA installée sur le tel ? hors scope MVP — donc juste site mobile responsive)
2. **Accueil** : regarde les 3 KPI + lit l'Insight Message du moment
3. Si Insight Message = "Votre site vous apporte 3 nouveaux prospects" → clic → arrive sur **CRM**
4. Sur CRM : voit la liste des 3 nouveaux prospects (highlight visuel "new")
5. Clic sur un prospect → modal/page détail → coche "Contacté"
6. _Optionnel_ : ajoute une note ("Réparation urgente", "Devis envoyé")
7. Quand le prospect signe → coche "Devenu client"

### 3.3 Consulter les analytics (cas occasionnel)

1. Marie veut voir l'évolution → **Analyse du site**
2. Voit les 4 KPIs en haut + un graphe "Personnes visitant au fil du temps"
3. Voit "D'où viennent vos visiteurs" (donut Google / Facebook / Direct / Autre — alimenté par les _traffic sources_ GA4, à ne pas confondre avec la colonne « Source » du CRM qui affiche le connecteur d'origine du lead — cf. `UX-glossaire.md §3`)
4. Voit "Vos pages les plus populaires" (bar chart)
5. **Pas de filtres avancés**, pas de date picker au-delà de 7j / 30j

### 3.4 Demander une modification

1. Depuis l'**Accueil** → clic CTA "Demander des modifs"
   _OU_ depuis sidebar → **Assistance**
2. Formulaire **Nouvelle demande** :
    - Page concernée (texte libre, ex: "Page d'accueil")
    - "Que souhaitez-vous que nous changions ?" (textarea)
    - Priorité (dropdown : Normale par défaut)
3. Submit → message de confirmation
4. **Liste des demandes** (sous le formulaire ou à côté) :
    - Soumis / En cours / Terminé
    - Date + premier extrait du message
5. _Pas d'assignation visible, pas de catégorie, pas de chat threadé visible côté client (le modèle DB le supporte, l'admin s'en sert en interne)_

### 3.5 Connexion / mot de passe oublié

1. `/login` → email + mot de passe
2. Lien "Mot de passe oublié ?" → `/forgot-password`
3. Email avec lien de reset → définition d'un nouveau mot de passe
4. États (annotation maquette Login) : Empty / Typing / Error (wrong login) / Loading / Success (redirect)

---

## 4. Parcours admin

### 4.1 Onboarder un nouveau client (workflow critique)

1. Pedro va sur **Admin → Clients → Nouveau client**
2. Crée la fiche client : nom de l'entreprise, contact email, contact phone, notes internes
3. Sur la fiche client :
    - Ajoute le ou les sites web (URL, nom, `connector` attendu pour les leads entrants)
    - Génère/affiche la clé API webhook → à coller dans le site WordPress
    - Connecte les intégrations Google (GA4 / GBP / GSC) en OAuth (chacune)
4. **Admin → Utilisateurs → Inviter un utilisateur**
    - Email, nom, rôle (`client`), client assigné
    - Email d'invitation envoyé automatiquement

### 4.2 Routine quotidienne

1. Connexion → **Accueil agence** (vue tous clients confondus)
2. Voit : nb total de prospects nouveaux 24h, nb demandes ouvertes, badge sur Assistance
3. Clic sur badge Assistance → liste des demandes ouvertes (filtrable par client)
4. Traite les demandes : marque "En cours" → "Terminé"
5. Optionnel : répond depuis le détail de la demande (annotation maquette : pas de chat threadé visible côté client, mais le modèle DB le supporte → admin peut écrire des réponses internes)

### 4.3 Debug d'un client (impersonation)

1. **Admin → Clients → [Le Jardin] → Voir comme ce client**
2. Pedro voit le dashboard exactement comme Marie (cookie `impersonate` 24h)
3. Banner "Vous êtes en mode impersonation" visible en haut
4. Clic "Quitter le mode" → retour vue admin

### 4.4 Régénérer une clé API

1. Site web compromis ou besoin de rotation
2. **Admin → Clients → [client] → Site → "Régénérer la clé"**
3. Nouvelle clé affichée + copiable
4. Pedro met à jour la conf WordPress du site manuellement (le push automatique via mu-plugin est supprimé en E1)

---

## 5. États transverses (à concevoir pour chaque écran)

D'après les annotations maquettes, chaque écran doit gérer :

| État                    | Quand                              | Traitement UI                                                                                     |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Empty / No data yet** | Premier login, intégration vide    | Message d'accueil chaleureux, jamais alarmant                                                     |
| **Loading**             | Fetch initial                      | Skeleton (loading.tsx existant)                                                                   |
| **Error**               | Échec API GA4/GBP/GSC              | Message neutre : _"On rencontre un problème, on regarde ça"_ — pas de stack trace ni de code HTTP |
| **Stale**               | Cache > 30 min, refresh impossible | Affiche les données + petit timestamp _"Mis à jour il y a 1h"_                                    |
| **Disconnected**        | Intégration Google déconnectée     | CTA _"Reconnectez votre compte Google"_ → flow OAuth                                              |

---

## 6. Pages écran par écran — récap

| Écran                             | Route                                         | Maquette ?                                        | Rôle                                  |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| Login                             | `/login`                                      | ✅                                                | tous                                  |
| Mot de passe oublié               | `/forgot-password`                            | ❌ (à improviser)                                 | tous                                  |
| Accept invitation                 | `/invite/[token]`                             | ❌ (à improviser)                                 | tous                                  |
| **Accueil**                       | `/dashboard`                                  | ✅                                                | client (+ admin avec variante agence) |
| **CRM / Contacter les prospects** | `/leads`                                      | ✅                                                | client + admin                        |
| Détail prospect                   | `/leads/[id]`                                 | ❌ (à improviser depuis CRM)                      | client + admin                        |
| **Analyse du site**               | `/analytics`                                  | ✅                                                | client                                |
| **Classements Google**            | `/search-console`                             | ✅                                                | client                                |
| **Google My Business**            | `/business-profile`                           | ❌ (à improviser)                                 | client                                |
| **Assistance** (formulaire)       | `/requests` (renommer `/tickets`)             | ✅                                                | client                                |
| Liste des demandes                | `/requests` (même page, section sous le form) | ⚠️ noté dans l'annotation, pas dessiné séparément | client                                |
| Détail d'une demande              | `/requests/[id]`                              | ❌ (à improviser)                                 | client + admin                        |
| Paramètres / profil               | `/settings`                                   | ❌ (à improviser)                                 | tous                                  |
| Admin Clients                     | `/admin/clients`                              | ❌                                                | admin                                 |
| Détail client                     | `/admin/clients/[id]`                         | ❌                                                | admin                                 |
| Admin Utilisateurs                | `/admin/users`                                | ❌                                                | admin                                 |
| Admin Sites                       | `/admin/websites`                             | ❌                                                | admin                                 |

---

## 7. Points d'attention design

### 7.1 Mobile-first

Marie consulte d'abord depuis son téléphone. La sidebar verticale **doit** se replier en menu hamburger ou bottom-nav sur mobile.

### 7.2 Layout du Classements Google (point ouvert — cf. `Mission.md §8`)

La maquette **Google search console** utilise un **header horizontal** + zone centrale, sans sidebar dark teal. Hypothèses :

1. **Soit** : version "publique partageable" (lien envoyé au client par email) — peu probable, pas d'autre indice
2. **Soit** : variation de design en cours
3. **Soit** : page très visuelle qui demande plus de largeur

Recommandation : **traiter comme variation de présentation, garder la même sidebar** dans le code, mais adopter la grille horizontale des KPIs/charts (4 cards sur une ligne + grand chart pleine largeur). À valider avec Jessie en début d'E3.

### 7.3 Renommage `/tickets` → `/requests` (fait en E3)

Route et composants renommés en `requests` ; **la table DB reste `tickets`** (pas de
migration utile). L'UI dit partout "demande" / "Assistance".

### 7.4 Insight Message remplace la cloche de notifications

Confirmé par l'annotation : "This replaces notifications". Cohérent avec la suppression du module push (Phase 1 ✅).

### 7.5 Contradiction CRM annotation vs maquette finale

L'annotation dit _"No complexity, no filters, no pipeline"_. La maquette finale montre une recherche + un filtre + une pagination "1-10 of 1000". Hypothèses :

- L'annotation visait l'esprit ("pas de Kanban / funnel marketing"), pas l'absence stricte de filtres
- La pagination avec 1000 est obligatoire dès qu'on a beaucoup de prospects

Recommandation : **garder recherche + pagination 10/page**, **retirer les filtres avancés (multi-statut, multi-date)**, ne garder qu'un filtre de statut simple si jamais.

---

## 8. Risques de parcours

| Risque                                      | Mitigation                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Marie ne comprend pas un KPI                | Tooltips au survol (mais accessibles tap mobile) avec phrase courte                     |
| Pas de données GA4/GBP au démarrage         | États "no data yet" soignés, message rassurant                                          |
| Marie demande "où sont mes notifications ?" | L'Insight Message + email Resend sur nouveau lead doivent suffire ; documenter ce choix |
| Marie change de site (multi-site)           | Sélecteur de site dans la sidebar (déjà existant : `client-switcher.tsx`)               |
| Marie veut exporter ses prospects           | Pas dans le scope MVP (annotation : "No complexity"). À noter pour V2                   |

---

## 9. Glossaire associé

Pour le vocabulaire exact à utiliser dans chaque écran, voir **`docs/UX-glossaire.md`**.
