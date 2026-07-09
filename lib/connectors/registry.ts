import type { SubmissionParser } from "./types";

const FALLBACK_KIND = "generic-webhook";

const parsers = new Map<string, SubmissionParser>();

export function registerParser(parser: SubmissionParser): void {
    if (parsers.has(parser.kind)) {
        throw new Error(`Parser "${parser.kind}" already registered`);
    }
    parsers.set(parser.kind, parser);
}

export function getParser(kind: string | null | undefined): SubmissionParser | null {
    if (!kind) return null;
    return parsers.get(kind) ?? null;
}

/**
 * Résout un parseur par `kind`, en retombant sur le parseur générique si le
 * `kind` est inconnu ou absent.
 *
 * @throws si ni le parseur demandé ni le fallback ne sont enregistrés.
 */
export function getParserOrFallback(kind: string | null | undefined): SubmissionParser {
    const direct = getParser(kind);
    if (direct) return direct;
    const fallback = parsers.get(FALLBACK_KIND);
    if (!fallback) {
        throw new Error(`Fallback parser "${FALLBACK_KIND}" is not registered`);
    }
    return fallback;
}

export function listParsers(): SubmissionParser[] {
    return Array.from(parsers.values());
}
