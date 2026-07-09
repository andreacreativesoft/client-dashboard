# Connecteurs de leads

> Doc d'extension de l'architecture pluggable d'inputs de leads (livrée en E4).
> Cadrage produit : `docs/Mission.md §7` (connecteurs ≠ origine marketing).

---

## Principe directeur

> **On adapte les connecteurs aux capacités des systèmes en face, pas l'inverse.**

Un connecteur expose ce que son système externe sait faire — pas ce qu'on aimerait qu'il fasse. Le coeur `leads` consomme un `NormalizedLead` ; il ignore qui l'a produit et reste agnostique. L'UI utilise les _capabilities_ déclarées par chaque connecteur (ex. afficher un bouton "Répondre via le canal d'origine" seulement si `capabilities.includes("reply")`).

---

## Concepts

### Connecteur

Un _connecteur_ = un adapter pour un système d'input externe (form WordPress, Facebook Lead Ads, Instagram DM, chat widget, etc.). Il porte un slug stable, un label UI, une liste de _capabilities_, et au moins la fonction `receive()`.

### Capability

| Capability | Signification                                                    | Statut V1                                                     |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `receive`  | Sait normaliser un payload en `NormalizedLead`. **Obligatoire.** | ✅ Tous V1                                                    |
| `reply`    | Sait envoyer une réponse au lead via le même canal.              | ❌ V2 — interface posée mais aucun connecteur ne l'implémente |

D'autres capabilities peuvent être ajoutées (enrichment, tagging, polling pull…) sans toucher le coeur — il suffit d'étendre `Capability` et l'interface `Connector`.

### Slug

Identifiant stable, en kebab-case. Stocké dans :

- `websites.connector` — slug attendu pour les leads entrants de ce site
- `leads.connector` — slug du connecteur qui a effectivement produit ce lead

Slug ≠ enum DB strict (varchar). La registry TS est la source de vérité runtime — ajouter un connecteur ne demande pas de migration.

---

## Connecteurs V1 livrés

| Slug              | Label UI   | Capabilities | Fichier                                   |
| ----------------- | ---------- | ------------ | ----------------------------------------- |
| `wordpress-form`  | "Site web" | `receive`    | `lib/leads/connectors/wordpress-form.ts`  |
| `generic-webhook` | "Site web" | `receive`    | `lib/leads/connectors/generic-webhook.ts` |

`wordpress-form` essaie les conventions des plugins WP courants (Elementor `body.fields.*`, CF7, WPForms) ; en cas d'échec, il _délègue_ à `generic-webhook`. `generic-webhook` est la dernière chance — il scanne les clés et patterns de valeurs avec un dictionnaire multi-langue (EN/RO/FR/NL/ES/DE/RU).

---

## Ajouter un nouveau connecteur

Trois étapes, un seul fichier dans le cas le plus simple.

### 1. Écrire le connecteur

```ts
// lib/leads/connectors/facebook-lead-ads.ts
import { sanitize, sanitizeEmail, sanitizePhone, truncateRaw } from "./shared";
import type { Connector } from "./types";

export const facebookLeadAdsConnector: Connector = {
    slug: "facebook-lead-ads",
    label: "Facebook",
    capabilities: ["receive"],          // ajouter "reply" si applicable
    canHandle(payload) {
        // Heuristique : payload Facebook Lead Ads a un champ `leadgen_id`.
        return typeof payload === "object" && payload !== null && "leadgen_id" in payload;
    },
    async receive(payload, ctx) {
        // ... récupérer le lead via Graph API avec ctx ...
        return {
            name: sanitize(/* … */, 255),
            email: sanitizeEmail(/* … */),
            phone: sanitizePhone(/* … */),
            message: null,
            form_name: sanitize(/* … */, 255),
            raw_data: truncateRaw(payload as Record<string, unknown>),
        };
    },
    // Optionnel — si Facebook permet de répondre côté Messenger :
    // async reply(leadId, message, ctx) { /* ... */ },
};
```

### 2. L'enregistrer dans la registry

```ts
// lib/leads/connectors/index.ts
import { facebookLeadAdsConnector } from "./facebook-lead-ads";

export function registerAllConnectors(): void {
    if (registered) return;
    registered = true;
    registerConnector(genericWebhookConnector);
    registerConnector(wordpressFormConnector);
    registerConnector(facebookLeadAdsConnector); // ← une ligne ajoutée
}
```

### 3. Le rendre sélectionnable côté admin

```ts
// app/(dashboard)/admin/clients/[id]/website-form.tsx
const CONNECTORS = [
    { value: "wordpress-form", label: "Site WordPress (Elementor / CF7 / WPForms…)" },
    { value: "generic-webhook", label: "Webhook générique (autres systèmes)" },
    { value: "facebook-lead-ads", label: "Facebook Lead Ads" }, // ← une ligne ajoutée
];
```

### Cas avancés

Si le connecteur n'utilise pas le webhook entrant unique (ex. Instagram DM via poll API ou un autre endpoint dédié), créer une nouvelle route API (`app/api/connectors/<slug>/route.ts`) qui appelle directement `connector.receive(...)` et insère via la même logique que la route webhook.

Si le connecteur implémente `reply`, l'UI détail-lead affichera automatiquement un bouton "Répondre via le canal d'origine" (à câbler dans `app/(dashboard)/leads/[id]/page.tsx` quand le premier connecteur `reply` arrive).

---

## Interface de référence

```ts
// lib/leads/connectors/types.ts (extrait)

export type Capability = "receive" | "reply";

export type NormalizedLead = {
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    form_name: string | null;
    raw_data: Record<string, unknown>;
};

export interface Connector {
    slug: string;
    label: string;
    capabilities: Capability[];
    canHandle?(payload: unknown): boolean;
    receive(payload: unknown, ctx: ReceiveContext): Promise<NormalizedLead> | NormalizedLead;
    reply?(leadId: string, message: string, ctx: ReplyContext): Promise<void>;
}
```

Voir le fichier source pour les détails complets (`ReceiveContext`, `ReplyContext`).

---

## Sélection au runtime

Pour les leads entrants via le webhook unique (`POST /api/webhooks/lead`) :

1. La route lit `websites.connector` (slug défini par Pedro à la création du site)
2. `getConnectorOrFallback(slug)` retourne le connecteur correspondant — ou `generic-webhook` si le slug est inconnu
3. `connector.receive(payload, ctx)` produit le `NormalizedLead`
4. La route insère le lead avec `connector = connector.slug`

`canHandle()` n'est _pas_ consulté par le dispatcher principal — il est posé pour de futurs cas de dispatch automatique (ex. plusieurs connecteurs candidats pour un même site), mais en V1 le slug du site fait foi.

---

## Backfill

Migration `026_leads_connector.sql` :

- Tous les `leads` existants → `connector = 'generic-webhook'` (impossible de déduire après coup)
- Les `websites` avec `source_type` legacy (`elementor` / `wpforms` / `contact_form_7`) → `connector = 'wordpress-form'` (tous gérés par le même connecteur)
- Les autres → `connector = 'generic-webhook'`

---

## Voir aussi

| Doc                             | Rôle                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `docs/Mission.md §7`            | Cadrage produit (connecteurs ≠ origine marketing)               |
| `docs/Backlog.md F6.10`         | État de la feature                                              |
| `docs/Domain-model.md` §3 leads | `leads.source` (audit) vs `leads.connector` (système d'origine) |
| `docs/UX-glossaire.md §3`       | Mapping `connector slug ↔ libellé UI`                           |
