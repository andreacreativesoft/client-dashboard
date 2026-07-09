import type { AppLanguage, TicketPriority } from "@/types/database";

// Registry des types de demande : source de vérité unique (grille de cards +
// formulaire adaptatif + rendu du détail). Donnée pure (pas de React) pour être
// utilisable serveur (action, seed) ET client (form).
//
// i18n : les chaînes visibles par le CLIENT sont localisées (en / fr-BE / ro).
// L'admin voit le fr-BE par défaut. Les `details` stockent les réponses brutes
// de l'utilisateur (neutres) ; le rendu utilise le registry dans la langue du
// lecteur. Les noms d'icônes sont mappés vers des composants lucide dans l'UI.

export type Localized = Record<AppLanguage, string>;

/** Résout une chaîne localisée (fallback fr-BE). */
export function tr(value: Localized, lang: AppLanguage): string {
    return value[lang] || value["fr-BE"];
}

export type TicketFieldType = "text" | "textarea" | "select" | "url" | "url_list" | "date";

export interface TicketFieldOption {
    value: string;
    label: Localized;
}

export interface TicketField {
    key: string;
    label: Localized;
    type: TicketFieldType;
    required?: boolean;
    placeholder?: Localized;
    help?: Localized;
    options?: TicketFieldOption[];
}

export interface TicketTypeDef {
    id: string;
    label: Localized;
    description: Localized;
    /** Nom d'icône lucide (mappé en composant dans la grille de cards). */
    icon: string;
    /** Classes d'accent de la pastille d'icône (bg + text). */
    accent: string;
    /** Priorité posée automatiquement à la création (l'admin peut ajuster). */
    defaultPriority: TicketPriority;
    /** Champ dont la valeur (saisie utilisateur, neutre) devient le sujet. */
    subjectField?: string;
    fields: TicketField[];
}

const SINCE_OPTIONS: TicketFieldOption[] = [
    {
        value: "today",
        label: { en: "Today", "fr-BE": "Aujourd'hui", ro: "Astăzi" },
    },
    {
        value: "days",
        label: { en: "For a few days", "fr-BE": "Depuis quelques jours", ro: "De câteva zile" },
    },
    {
        value: "always",
        label: { en: "For a while / not sure", "fr-BE": "Depuis longtemps", ro: "De mult timp" },
    },
    {
        value: "unknown",
        label: { en: "I don't know", "fr-BE": "Je ne sais pas", ro: "Nu știu" },
    },
];

const ONE_PER_LINE: Localized = {
    en: "One link per line",
    "fr-BE": "Un lien par ligne",
    ro: "Un link pe linie",
};

export const TICKET_TYPES: TicketTypeDef[] = [
    {
        id: "content_change",
        label: { en: "Edit content", "fr-BE": "Modifier du contenu", ro: "Modifică conținut" },
        description: {
            en: "Change a text, price, opening hours, a photo…",
            "fr-BE": "Changer un texte, un prix, des horaires, une photo…",
            ro: "Schimbă un text, un preț, programul, o poză…",
        },
        icon: "PencilLine",
        accent: "bg-blue-50 text-blue-600",
        defaultPriority: "medium",
        subjectField: "page",
        fields: [
            {
                key: "page",
                label: {
                    en: "Which page?",
                    "fr-BE": "Quelle page est concernée ?",
                    ro: "Care pagină?",
                },
                type: "text",
                required: true,
                placeholder: {
                    en: "E.g. Home, Contact, /pricing",
                    "fr-BE": "Ex : Accueil, Contact, /tarifs",
                    ro: "Ex: Acasă, Contact, /prețuri",
                },
            },
            {
                key: "changes",
                label: {
                    en: "What needs to change?",
                    "fr-BE": "Que faut-il changer ?",
                    ro: "Ce trebuie schimbat?",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "Describe what should be modified",
                    "fr-BE": "Décrivez ce qui doit être modifié",
                    ro: "Descrieți ce trebuie modificat",
                },
            },
            {
                key: "new_content",
                label: {
                    en: "New content (exact text if possible)",
                    "fr-BE": "Nouveau contenu (texte exact si possible)",
                    ro: "Conținut nou (text exact dacă e posibil)",
                },
                type: "textarea",
                placeholder: {
                    en: "Paste the final text to publish",
                    "fr-BE": "Collez ici le texte définitif à mettre en ligne",
                    ro: "Lipiți textul final de publicat",
                },
            },
            {
                key: "deadline",
                label: { en: "Wanted by", "fr-BE": "Souhaité pour le", ro: "Dorit până la" },
                type: "date",
            },
        ],
    },
    {
        id: "bug",
        label: {
            en: "Report a problem",
            "fr-BE": "Signaler un problème",
            ro: "Raportează o problemă",
        },
        description: {
            en: "Something is not working correctly.",
            "fr-BE": "Quelque chose ne fonctionne pas correctement.",
            ro: "Ceva nu funcționează corect.",
        },
        icon: "Bug",
        accent: "bg-orange-50 text-orange-600",
        defaultPriority: "high",
        subjectField: "page",
        fields: [
            {
                key: "page",
                label: {
                    en: "Page or URL affected",
                    "fr-BE": "Page ou URL concernée",
                    ro: "Pagina sau URL-ul afectat",
                },
                type: "text",
                required: true,
                placeholder: {
                    en: "E.g. Contact page, quote form",
                    "fr-BE": "Ex : page Contact, formulaire de devis",
                    ro: "Ex: pagina Contact, formular de ofertă",
                },
            },
            {
                key: "problem",
                label: {
                    en: "What happens?",
                    "fr-BE": "Que se passe-t-il ?",
                    ro: "Ce se întâmplă?",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "Describe the problem and what you expected",
                    "fr-BE": "Décrivez le problème et ce que vous attendiez",
                    ro: "Descrieți problema și ce vă așteptați",
                },
            },
            {
                key: "since",
                label: { en: "Since when?", "fr-BE": "Depuis quand ?", ro: "De când?" },
                type: "select",
                options: SINCE_OPTIONS,
            },
            {
                key: "reference",
                label: {
                    en: "Link or screenshot (optional)",
                    "fr-BE": "Lien ou capture d'écran (optionnel)",
                    ro: "Link sau captură de ecran (opțional)",
                },
                type: "url",
                placeholder: { en: "https://…", "fr-BE": "https://…", ro: "https://…" },
            },
        ],
    },
    {
        id: "site_down",
        label: { en: "Site is down", "fr-BE": "Site inaccessible", ro: "Site indisponibil" },
        description: {
            en: "The website doesn't load at all.",
            "fr-BE": "Le site ne s'affiche plus du tout.",
            ro: "Site-ul nu se mai încarcă deloc.",
        },
        icon: "ServerCrash",
        accent: "bg-red-50 text-red-600",
        defaultPriority: "urgent",
        fields: [
            {
                key: "url",
                label: { en: "Site address", "fr-BE": "Adresse du site", ro: "Adresa site-ului" },
                type: "text",
                required: true,
                placeholder: {
                    en: "https://mysite.com",
                    "fr-BE": "https://monsite.be",
                    ro: "https://site.ro",
                },
            },
            {
                key: "error",
                label: {
                    en: "Error message shown?",
                    "fr-BE": "Message d'erreur affiché ?",
                    ro: "Mesaj de eroare afișat?",
                },
                type: "textarea",
                placeholder: {
                    en: "Copy the exact message if any",
                    "fr-BE": "Copiez le message exact si vous en voyez un",
                    ro: "Copiați mesajul exact dacă există",
                },
            },
            {
                key: "since",
                label: { en: "Since when?", "fr-BE": "Depuis quand ?", ro: "De când?" },
                type: "select",
                options: SINCE_OPTIONS,
            },
        ],
    },
    {
        id: "new_page",
        label: {
            en: "New page / section",
            "fr-BE": "Nouvelle page / section",
            ro: "Pagină / secțiune nouă",
        },
        description: {
            en: "Add a page or section to the site.",
            "fr-BE": "Ajouter une page ou une section au site.",
            ro: "Adaugă o pagină sau o secțiune.",
        },
        icon: "FilePlus2",
        accent: "bg-emerald-50 text-emerald-600",
        defaultPriority: "medium",
        subjectField: "objective",
        fields: [
            {
                key: "objective",
                label: {
                    en: "Purpose of the page",
                    "fr-BE": "Objectif de la page",
                    ro: "Scopul paginii",
                },
                type: "text",
                required: true,
                placeholder: {
                    en: "E.g. present our new services",
                    "fr-BE": "Ex : présenter nos nouveaux services",
                    ro: "Ex: prezentarea noilor servicii",
                },
            },
            {
                key: "content",
                label: {
                    en: "Content to include",
                    "fr-BE": "Contenu à inclure",
                    ro: "Conținut de inclus",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "Texts, photos, info to feature",
                    "fr-BE": "Textes, photos, infos à faire figurer",
                    ro: "Texte, poze, informații de afișat",
                },
            },
            {
                key: "references",
                label: {
                    en: "Examples / inspiration (links)",
                    "fr-BE": "Exemples / inspirations (liens)",
                    ro: "Exemple / inspirație (linkuri)",
                },
                type: "url_list",
                placeholder: ONE_PER_LINE,
            },
            {
                key: "deadline",
                label: { en: "Wanted by", "fr-BE": "Souhaité pour le", ro: "Dorit până la" },
                type: "date",
            },
        ],
    },
    {
        id: "new_feature",
        label: {
            en: "New feature",
            "fr-BE": "Nouvelle fonctionnalité",
            ro: "Funcționalitate nouă",
        },
        description: {
            en: "Form, booking, shop, gallery…",
            "fr-BE": "Formulaire, réservation, boutique, galerie…",
            ro: "Formular, rezervare, magazin, galerie…",
        },
        icon: "Sparkles",
        accent: "bg-violet-50 text-violet-600",
        defaultPriority: "medium",
        subjectField: "feature",
        fields: [
            {
                key: "feature",
                label: {
                    en: "Which feature?",
                    "fr-BE": "Quelle fonctionnalité ?",
                    ro: "Care funcționalitate?",
                },
                type: "select",
                required: true,
                options: [
                    {
                        value: "form",
                        label: {
                            en: "Contact form",
                            "fr-BE": "Formulaire de contact",
                            ro: "Formular de contact",
                        },
                    },
                    {
                        value: "booking",
                        label: {
                            en: "Booking / appointments",
                            "fr-BE": "Réservation / prise de RDV",
                            ro: "Rezervare / programări",
                        },
                    },
                    {
                        value: "payment",
                        label: {
                            en: "Online payment",
                            "fr-BE": "Paiement en ligne",
                            ro: "Plată online",
                        },
                    },
                    {
                        value: "gallery",
                        label: {
                            en: "Photo gallery",
                            "fr-BE": "Galerie photos",
                            ro: "Galerie foto",
                        },
                    },
                    {
                        value: "shop",
                        label: {
                            en: "Online shop",
                            "fr-BE": "Boutique en ligne",
                            ro: "Magazin online",
                        },
                    },
                    { value: "other", label: { en: "Other", "fr-BE": "Autre", ro: "Altceva" } },
                ],
            },
            {
                key: "detail",
                label: {
                    en: "Describe your need",
                    "fr-BE": "Décrivez votre besoin",
                    ro: "Descrieți nevoia",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "How do you imagine it working?",
                    "fr-BE": "Comment imaginez-vous que ça fonctionne ?",
                    ro: "Cum vă imaginați că funcționează?",
                },
            },
            {
                key: "references",
                label: {
                    en: "Examples you like (links)",
                    "fr-BE": "Exemples qui vous plaisent (liens)",
                    ro: "Exemple care vă plac (linkuri)",
                },
                type: "url_list",
                placeholder: ONE_PER_LINE,
            },
        ],
    },
    {
        id: "design",
        label: { en: "Design / look", "fr-BE": "Design / apparence", ro: "Design / aspect" },
        description: {
            en: "Colors, logo, layout, style.",
            "fr-BE": "Couleurs, logo, mise en page, style.",
            ro: "Culori, logo, aspect, stil.",
        },
        icon: "Palette",
        accent: "bg-pink-50 text-pink-600",
        defaultPriority: "low",
        subjectField: "element",
        fields: [
            {
                key: "element",
                label: { en: "Which element?", "fr-BE": "Quel élément ?", ro: "Care element?" },
                type: "text",
                required: true,
                placeholder: {
                    en: "E.g. logo, colors, homepage",
                    "fr-BE": "Ex : logo, couleurs, page d'accueil",
                    ro: "Ex: logo, culori, pagina principală",
                },
            },
            {
                key: "change",
                label: {
                    en: "Desired change",
                    "fr-BE": "Changement souhaité",
                    ro: "Schimbarea dorită",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "Describe the look you'd like",
                    "fr-BE": "Décrivez le rendu que vous aimeriez",
                    ro: "Descrieți aspectul dorit",
                },
            },
            {
                key: "inspirations",
                label: {
                    en: "Inspiration (links)",
                    "fr-BE": "Inspirations (liens)",
                    ro: "Inspirație (linkuri)",
                },
                type: "url_list",
                placeholder: ONE_PER_LINE,
            },
        ],
    },
    {
        id: "seo",
        label: { en: "Google visibility", "fr-BE": "Visibilité Google", ro: "Vizibilitate Google" },
        description: {
            en: "Be found better on Google (SEO).",
            "fr-BE": "Être mieux trouvé sur Google (référencement).",
            ro: "Fii găsit mai bine pe Google (SEO).",
        },
        icon: "Search",
        accent: "bg-amber-50 text-amber-600",
        defaultPriority: "medium",
        subjectField: "objective",
        fields: [
            {
                key: "objective",
                label: { en: "Your goal", "fr-BE": "Votre objectif", ro: "Obiectivul dvs." },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "E.g. show up for « plumber Liège »",
                    "fr-BE": "Ex : apparaître quand on cherche « plombier Liège »",
                    ro: "Ex: să apar la « instalator Liège »",
                },
            },
            {
                key: "keywords",
                label: { en: "Target keywords", "fr-BE": "Mots-clés visés", ro: "Cuvinte cheie" },
                type: "text",
                placeholder: {
                    en: "Comma-separated",
                    "fr-BE": "Séparés par des virgules",
                    ro: "Separate prin virgulă",
                },
            },
            {
                key: "area",
                label: {
                    en: "Geographic area",
                    "fr-BE": "Zone géographique",
                    ro: "Zona geografică",
                },
                type: "text",
                placeholder: {
                    en: "E.g. Liège area",
                    "fr-BE": "Ex : Liège et environs",
                    ro: "Ex: zona Liège",
                },
            },
            {
                key: "competitors",
                label: {
                    en: "Well-ranked competitors (links)",
                    "fr-BE": "Concurrents bien classés (liens)",
                    ro: "Concurenți bine clasați (linkuri)",
                },
                type: "url_list",
                placeholder: ONE_PER_LINE,
            },
        ],
    },
    {
        id: "domain_email",
        label: {
            en: "Domain / email / hosting",
            "fr-BE": "Domaine / email / hébergement",
            ro: "Domeniu / email / găzduire",
        },
        description: {
            en: "Domain name, email address, hosting, SSL.",
            "fr-BE": "Nom de domaine, adresse email, hébergement, SSL.",
            ro: "Nume de domeniu, email, găzduire, SSL.",
        },
        icon: "AtSign",
        accent: "bg-cyan-50 text-cyan-600",
        defaultPriority: "medium",
        subjectField: "topic",
        fields: [
            {
                key: "topic",
                label: { en: "Topic", "fr-BE": "Sujet", ro: "Subiect" },
                type: "select",
                required: true,
                options: [
                    {
                        value: "domain",
                        label: {
                            en: "Domain name",
                            "fr-BE": "Nom de domaine",
                            ro: "Nume de domeniu",
                        },
                    },
                    {
                        value: "email",
                        label: {
                            en: "Email address",
                            "fr-BE": "Adresse email",
                            ro: "Adresă email",
                        },
                    },
                    {
                        value: "hosting",
                        label: { en: "Hosting", "fr-BE": "Hébergement", ro: "Găzduire" },
                    },
                    {
                        value: "ssl",
                        label: {
                            en: "SSL / security",
                            "fr-BE": "Certificat SSL / sécurité",
                            ro: "SSL / securitate",
                        },
                    },
                    { value: "other", label: { en: "Other", "fr-BE": "Autre", ro: "Altceva" } },
                ],
            },
            {
                key: "detail",
                label: {
                    en: "Details of your request",
                    "fr-BE": "Détail de votre demande",
                    ro: "Detaliile cererii",
                },
                type: "textarea",
                required: true,
                placeholder: {
                    en: "Describe what you need",
                    "fr-BE": "Décrivez ce dont vous avez besoin",
                    ro: "Descrieți ce aveți nevoie",
                },
            },
        ],
    },
    {
        id: "billing",
        label: {
            en: "Billing / admin",
            "fr-BE": "Facturation / administratif",
            ro: "Facturare / administrativ",
        },
        description: {
            en: "Quote, invoice, contract, admin question.",
            "fr-BE": "Devis, facture, contrat, question administrative.",
            ro: "Ofertă, factură, contract, întrebare administrativă.",
        },
        icon: "Receipt",
        accent: "bg-slate-100 text-slate-600",
        defaultPriority: "medium",
        subjectField: "topic",
        fields: [
            {
                key: "topic",
                label: { en: "Subject", "fr-BE": "Objet", ro: "Obiect" },
                type: "select",
                required: true,
                options: [
                    { value: "quote", label: { en: "Quote", "fr-BE": "Devis", ro: "Ofertă" } },
                    {
                        value: "invoice",
                        label: { en: "Invoice", "fr-BE": "Facture", ro: "Factură" },
                    },
                    {
                        value: "contract",
                        label: { en: "Contract", "fr-BE": "Contrat", ro: "Contract" },
                    },
                    { value: "other", label: { en: "Other", "fr-BE": "Autre", ro: "Altceva" } },
                ],
            },
            {
                key: "detail",
                label: { en: "Details", "fr-BE": "Détail", ro: "Detalii" },
                type: "textarea",
                required: true,
            },
        ],
    },
    {
        id: "other",
        label: { en: "Other request", "fr-BE": "Autre demande", ro: "Altă cerere" },
        description: {
            en: "A question or request that doesn't fit elsewhere.",
            "fr-BE": "Une question ou une demande qui n'entre pas ailleurs.",
            ro: "O întrebare sau cerere care nu se încadrează altundeva.",
        },
        icon: "MessageCircle",
        accent: "bg-brand-soft text-brand",
        defaultPriority: "medium",
        subjectField: "title",
        fields: [
            {
                key: "title",
                label: {
                    en: "Subject of your request",
                    "fr-BE": "Sujet de votre demande",
                    ro: "Subiectul cererii",
                },
                type: "text",
                required: true,
                placeholder: {
                    en: "In a few words",
                    "fr-BE": "En quelques mots",
                    ro: "În câteva cuvinte",
                },
            },
            {
                key: "message",
                label: { en: "Your message", "fr-BE": "Votre message", ro: "Mesajul dvs." },
                type: "textarea",
                required: true,
            },
        ],
    },
];

export const DEFAULT_TICKET_TYPE = "other";

export function getTicketType(id: string | null | undefined): TicketTypeDef | undefined {
    return TICKET_TYPES.find((t) => t.id === id);
}

/** Libellé humain (localisé) d'une valeur de champ `select` (sinon valeur brute). */
export function fieldOptionLabel(field: TicketField, value: string, lang: AppLanguage): string {
    const opt = field.options?.find((o) => o.value === value);
    return opt ? tr(opt.label, lang) : value;
}

/**
 * Sujet du ticket = la saisie utilisateur du champ clé (neutre côté langue) ;
 * fallback sur le libellé fr-BE du type si pas de champ clé.
 */
export function composeSubject(type: TicketTypeDef, details: Record<string, string>): string {
    const seed = type.subjectField ? details[type.subjectField]?.trim() : "";
    return (seed || tr(type.label, "fr-BE")).slice(0, 200);
}

/** Rend les `details` en texte lisible dans une langue (carte détail + recherche). */
export function composeDescription(
    type: TicketTypeDef,
    details: Record<string, string>,
    lang: AppLanguage,
): string {
    return type.fields
        .map((f) => {
            const raw = (details[f.key] ?? "").trim();
            if (!raw) return null;
            const value = f.type === "select" ? fieldOptionLabel(f, raw, lang) : raw;
            return `${tr(f.label, lang)} :\n${value}`;
        })
        .filter(Boolean)
        .join("\n\n");
}
