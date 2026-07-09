/**
 * Presets de métadonnées. `type = null` = texte libre. Un preset attache à un
 * `type` : libellé par défaut (éditable), kind de valeur (validation + rendu UI),
 * icône (nom lucide, mappé côté composant) et la sensibilité par défaut.
 * Ajouter un preset = 1 entrée ici.
 */
export type AttributeValueKind = "url" | "secret" | "email" | "text";

export type AttributePreset = {
    type: string;
    label: string;
    icon: string;
    valueKind: AttributeValueKind;
    defaultSensitive: boolean;
};

export const ATTRIBUTE_PRESETS: AttributePreset[] = [
    {
        type: "github",
        label: "Dépôt GitHub",
        icon: "Code2",
        valueKind: "url",
        defaultSensitive: false,
    },
    {
        type: "figma",
        label: "Maquette Figma",
        icon: "Frame",
        valueKind: "url",
        defaultSensitive: false,
    },
    {
        type: "asana",
        label: "Projet Asana",
        icon: "SquareKanban",
        valueKind: "url",
        defaultSensitive: false,
    },
    {
        type: "slack",
        label: "Canal Slack",
        icon: "Hash",
        valueKind: "url",
        defaultSensitive: false,
    },
    {
        type: "hosting",
        label: "Hébergeur",
        icon: "Server",
        valueKind: "url",
        defaultSensitive: false,
    },
    {
        type: "ftp",
        label: "Accès FTP",
        icon: "FolderLock",
        valueKind: "secret",
        defaultSensitive: true,
    },
    {
        type: "wp-admin",
        label: "WordPress admin",
        icon: "KeyRound",
        valueKind: "secret",
        defaultSensitive: true,
    },
    {
        type: "email",
        label: "Email de contact",
        icon: "Mail",
        valueKind: "email",
        defaultSensitive: false,
    },
];

export function getPreset(type: string | null | undefined): AttributePreset | null {
    if (!type) return null;
    return ATTRIBUTE_PRESETS.find((p) => p.type === type) ?? null;
}
