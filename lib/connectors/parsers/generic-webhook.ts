import { isRecord, sanitize, sanitizeEmail, sanitizePhone, truncateRaw } from "../shared";
import type { SubmissionParser } from "../types";

// Patterns de noms de champ multi-langues — couvre EN / RO / FR / NL / ES / DE / RU
// plus quelques variantes régionales (ex. néerlandais de Belgique).
const NAME_KEYS =
    /^(name|full_name|first_name|last_name|your_name|nume|nom|nombre|nome|naam|имя|vorname|nachname|prenume|nume_complet)$/i;
const EMAIL_KEYS = /^(email|your_email|e-?mail|correo|courriel|почта|adresa_email|email_adres)$/i;
const PHONE_KEYS =
    /^(phone|tel|telephone|your_phone|telefon|telefono|téléphone|телефон|mobil|celular|telefoon|numar_telefon|gsm)$/i;
const MESSAGE_KEYS =
    /^(message|your_message|comment|mesaj|mensaje|messaggio|сообщение|nachricht|comentario|bericht|mesajul)$/i;
const FORM_NAME_KEYS = /^(form_name|form_id|formName|form_title)$/i;
const SKIP_KEYS =
    /^(key|api_key|action|referrer|referer|_wp_nonce|nonce|timestamp|token|source|fields|post_id|form_fields|queried_id)$/i;

function autoDetectFields(body: Record<string, unknown>) {
    let name: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    let message: string | null = null;
    let form_name: string | null = null;

    for (const [key, value] of Object.entries(body)) {
        if (SKIP_KEYS.test(key) || value === null || value === undefined) continue;
        const strVal = String(value).trim();
        if (!strVal) continue;

        if (!name && NAME_KEYS.test(key)) {
            name = strVal;
            continue;
        }
        if (!email && EMAIL_KEYS.test(key)) {
            email = strVal;
            continue;
        }
        if (!phone && PHONE_KEYS.test(key)) {
            phone = strVal;
            continue;
        }
        if (!message && MESSAGE_KEYS.test(key)) {
            message = strVal;
            continue;
        }
        if (!form_name && FORM_NAME_KEYS.test(key)) {
            form_name = strVal;
            continue;
        }

        // La clé n'a pas matché — on tente la détection par forme de valeur.
        if (!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
            email = strVal;
            continue;
        }
        if (
            !phone &&
            /^\+?[\d\s\-().]{6,}$/.test(strVal) &&
            strVal.replace(/\D/g, "").length >= 6
        ) {
            phone = strVal;
            continue;
        }
    }

    // Toujours pas de nom : on prend la première valeur texte courte non matchée.
    if (!name) {
        for (const [key, value] of Object.entries(body)) {
            if (SKIP_KEYS.test(key) || value === null || value === undefined) continue;
            const strVal = String(value).trim();
            if (
                !strVal ||
                strVal === email ||
                strVal === phone ||
                strVal === message ||
                strVal === form_name
            )
                continue;
            if (
                strVal.length <= 100 &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal) &&
                !/^\+?[\d\s\-().]{6,}$/.test(strVal)
            ) {
                name = strVal;
                break;
            }
        }
    }

    // Toujours pas de message : on prend la plus longue valeur texte restante.
    if (!message) {
        let longest = "";
        for (const [key, value] of Object.entries(body)) {
            if (SKIP_KEYS.test(key) || value === null || value === undefined) continue;
            const strVal = String(value).trim();
            if (
                !strVal ||
                strVal === email ||
                strVal === phone ||
                strVal === name ||
                strVal === form_name
            )
                continue;
            if (strVal.length > longest.length) longest = strVal;
        }
        if (longest.length > 0) message = longest;
    }

    return { name, email, phone, message, form_name };
}

/**
 * Parseur de dernier recours. Accepte n'importe quel payload et tente de trouver
 * name / email / phone / message par heuristiques (noms de clés + formes de valeur).
 */
export const genericWebhookParser: SubmissionParser = {
    kind: "generic-webhook",
    displayName: "Webhook générique",
    defaultLabel: "Prospect",
    receive(payload) {
        if (!isRecord(payload)) {
            return {
                name: null,
                email: null,
                phone: null,
                message: null,
                form_name: null,
                raw_data: {},
            };
        }
        const detected = autoDetectFields(payload);
        return {
            name: sanitize(detected.name, 255),
            email: sanitizeEmail(detected.email),
            phone: sanitizePhone(detected.phone),
            message: sanitize(detected.message, 5000),
            form_name: sanitize(detected.form_name, 255),
            raw_data: truncateRaw(payload),
        };
    },
};
