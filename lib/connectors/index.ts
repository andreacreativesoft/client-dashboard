import { genericWebhookParser } from "./parsers/generic-webhook";
import { wordpressFormParser } from "./parsers/wordpress-form";
import { registerParser } from "./registry";

/**
 * Import à effet de bord : enregistre chaque parseur livré une seule fois.
 * Importer ce module (route d'ingestion, UI admin) avant d'appeler
 * `getParser()` / `getParserOrFallback()` / `listParsers()`.
 *
 * Ajouter une source ? Voir docs/Connecteurs.md.
 */
let registered = false;

export function registerAllParsers(): void {
    if (registered) return;
    registered = true;
    registerParser(genericWebhookParser);
    registerParser(wordpressFormParser);
}

registerAllParsers();

export { getParser, getParserOrFallback, listParsers, registerParser } from "./registry";
export type { NormalizedSubmission, ReceiveContext, SubmissionParser } from "./types";
