/**
 * Parseurs de connecteurs : transforment un payload entrant en submission
 * normalisée. Une porte (table `connectors`) référence un parseur par `kind` ;
 * le parseur est une pure stratégie de normalisation, sans état ni I/O.
 *
 * Ajouter une source = 1 fichier dans `parsers/` + 1 ligne dans `index.ts`.
 * Voir docs/Connecteurs.md.
 */

/** Sortie d'un parseur — injectée telle quelle dans l'insert `submissions`. */
export type NormalizedSubmission = {
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    form_name: string | null;
    raw_data: Record<string, unknown>;
};

/** Contexte passé au parseur à l'arrivée d'un payload. */
export type ReceiveContext = {
    headers?: Headers;
};

export interface SubmissionParser {
    /** Slug stable stocké dans `connectors.kind`. */
    kind: string;
    /** Nom humain du connecteur (affiché dans l'UI au lieu du slug). */
    displayName: string;
    /** Libellé humain par défaut proposé à la création d'une porte de ce type. */
    defaultLabel: string;
    /** Normalise un payload entrant en submission. */
    receive(
        payload: unknown,
        ctx: ReceiveContext,
    ): Promise<NormalizedSubmission> | NormalizedSubmission;
}
