/**
 * Helpers de sanitisation partagés par les parseurs de connecteurs.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Tronque et retire les caractères de contrôle d'une valeur. */
export function sanitize(value: unknown, maxLength: number): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (str.length === 0) return null;
    // oxlint-disable-next-line no-control-regex
    const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    return cleaned.slice(0, maxLength) || null;
}

export function sanitizeEmail(value: unknown): string | null {
    const email = sanitize(value, 255);
    if (!email) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null;
}

export function sanitizePhone(value: unknown): string | null {
    const phone = sanitize(value, 50);
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+\-().  ]/g, "");
    const digitCount = cleaned.replace(/\D/g, "").length;
    return digitCount >= 6 ? cleaned : null;
}

/** Borne la taille de `raw_data` (50 KB) pour garder des lignes DB raisonnables. */
export function truncateRaw(body: Record<string, unknown>): Record<string, unknown> {
    const rawJson = JSON.stringify(body);
    if (rawJson.length > 50_000) {
        return { _truncated: true, _original_size: rawJson.length };
    }
    return body;
}
