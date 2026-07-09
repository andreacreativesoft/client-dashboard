/**
 * Plomberie commune aux endpoints d'ingestion. Chaque système expose SA route
 * dédiée (`app/api/ingest/<kind>/[token]`), taillée pour ses conventions
 * (format de payload, signature, handshake) ; ces helpers couvrent uniquement
 * ce qui est partagé : rate limit, résolution du connecteur par token, insertion
 * de la submission + effets de bord. La normalisation vit dans le parseur du `kind`.
 */
import { ActivityTypes } from "@/lib/constants/activity";
import { sendNewSubmissionNotifications } from "@/lib/notifications/submission-notifications";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

import type { NormalizedSubmission } from "./types";

export const INGEST_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-signature",
};

const RATE_LIMIT_PER_TOKEN = { windowMs: 60_000, maxRequests: 30 };
const RATE_LIMIT_PER_IP = { windowMs: 60_000, maxRequests: 60 };

/** Connecteur résolu par token, avec son site et son client. */
export type ResolvedConnector = {
    id: string;
    kind: string;
    label: string;
    signing_secret: string;
    config: Record<string, unknown>;
    is_active: boolean;
    website: {
        id: string;
        name: string;
        url: string;
        is_active: boolean;
        client_id: string;
        client: { business_name: string } | null;
    } | null;
};

type RateResult = { allowed: false; retryAfter: number } | { allowed: true; remaining: number };

/** Rate limit IP puis token. Retourne le verdict prêt à traduire en réponse. */
export async function ingestRateLimit(token: string, ip: string): Promise<RateResult> {
    const ipLimit = await rateLimit(`ip:${ip}`, RATE_LIMIT_PER_IP);
    if (!ipLimit.allowed) {
        return { allowed: false, retryAfter: Math.ceil((ipLimit.resetAt - Date.now()) / 1000) };
    }
    const tokenLimit = await rateLimit(`ingest:${token}`, RATE_LIMIT_PER_TOKEN);
    if (!tokenLimit.allowed) {
        return { allowed: false, retryAfter: Math.ceil((tokenLimit.resetAt - Date.now()) / 1000) };
    }
    return { allowed: true, remaining: tokenLimit.remaining };
}

/**
 * Résout un connecteur par son token d'ingestion (service_role, bypass RLS) et
 * vérifie qu'il correspond au `kind` attendu par la route appelante.
 * Retourne `null` si introuvable ou kind incohérent.
 */
export async function resolveConnector(
    token: string,
    expectedKind: string,
): Promise<ResolvedConnector | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("connectors")
        .select(
            `id, kind, label, signing_secret, config, is_active,
             website:websites!website_id(id, name, url, is_active, client_id,
                 client:clients!client_id(business_name))`,
        )
        .eq("ingest_token", token)
        .single<ResolvedConnector>();

    if (error || !data) return null;
    if (data.kind !== expectedKind) return null;
    return data;
}

/**
 * Insère la submission normalisée, journalise l'activité et déclenche les
 * notifications (non bloquant). Retourne l'id de la submission, ou `null` en cas d'échec.
 */
export async function persistSubmission(
    connector: ResolvedConnector,
    normalized: NormalizedSubmission,
): Promise<string | null> {
    const website = connector.website;
    if (!website) return null;
    const supabase = createAdminClient();

    const { data: submission, error } = await supabase
        .from("submissions")
        .insert({
            client_id: website.client_id,
            connector_id: connector.id,
            form_name: normalized.form_name,
            source: "webhook",
            name: normalized.name,
            email: normalized.email,
            phone: normalized.phone,
            message: normalized.message,
            raw_data: normalized.raw_data,
            status: "new",
        })
        .select("id")
        .single<{ id: string }>();

    if (error || !submission) {
        console.error("Failed to insert submission:", error);
        return null;
    }

    await supabase.from("activity_logs").insert({
        client_id: website.client_id,
        user_id: null,
        action_type: ActivityTypes.SUBMISSION_CREATED,
        description: "",
        metadata: {
            submissionId: submission.id,
            clientId: website.client_id,
            websiteId: website.id,
            connectorId: connector.id,
            submissionName: normalized.name ?? "",
        },
    });

    sendNewSubmissionNotifications({
        submissionId: submission.id,
        clientId: website.client_id,
        clientName: website.client?.business_name || "Client",
        websiteName: website.name,
        websiteUrl: website.url,
        submissionLabel: connector.label,
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        message: normalized.message,
        formName: normalized.form_name,
    }).catch((err) => {
        console.error("Error dispatching submission notifications:", err);
    });

    return submission.id;
}
