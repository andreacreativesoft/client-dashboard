import { isRecord, sanitize, sanitizeEmail, sanitizePhone, truncateRaw } from "../shared";
import type { SubmissionParser } from "../types";
import { genericWebhookParser } from "./generic-webhook";

/**
 * Parseur pour les plugins de formulaire WordPress (Elementor, WPForms, CF7…).
 * Essaie les noms de champ connus de ces plugins, puis retombe sur la détection
 * générique si rien n'a matché.
 */
export const wordpressFormParser: SubmissionParser = {
    kind: "wordpress-form",
    displayName: "WordPress (formulaire)",
    defaultLabel: "Formulaire",
    receive(payload, ctx) {
        if (!isRecord(payload)) {
            return genericWebhookParser.receive(payload, ctx);
        }
        const body = payload;
        const fields = isRecord(body.fields) ? body.fields : {};
        const combinedName = [body.first_name, body.last_name].filter(Boolean).join(" ");

        const name = sanitize(
            body.name ??
                body.full_name ??
                body.your_name ??
                fields.name ??
                fields.your_name ??
                combinedName,
            255,
        );
        const email = sanitizeEmail(
            body.email ?? body.your_email ?? fields.email ?? fields.your_email,
        );
        const phone = sanitizePhone(
            body.phone ??
                body.tel ??
                body.telephone ??
                body.your_phone ??
                fields.phone ??
                fields.tel,
        );
        const message = sanitize(
            body.message ??
                body.your_message ??
                body.comment ??
                fields.message ??
                fields.your_message,
            5000,
        );
        const form_name = sanitize(body.form_name ?? body.form_id ?? body.formName, 255);

        // Si les champs WP explicites n'ont rien donné, on retombe sur le détecteur
        // générique (ex. plugin émettant des noms de champ en roumain).
        if (!name && !email && !phone && !message) {
            return genericWebhookParser.receive(payload, ctx);
        }

        return { name, email, phone, message, form_name, raw_data: truncateRaw(body) };
    },
};
