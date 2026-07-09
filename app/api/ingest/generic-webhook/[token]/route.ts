/**
 * Endpoint dédié au connecteur `generic-webhook`.
 * Pour tout système capable de POSTer du JSON. Auth = token (chemin) + signature
 * HMAC-SHA256 (header `x-signature`) **obligatoire par défaut** : absente ou
 * invalide → 401. Désactivable par connecteur via `config.require_signature = false`
 * (mode token seul, moins sûr) pour un intégrateur incapable de signer.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
    INGEST_CORS_HEADERS as CORS,
    ingestRateLimit,
    persistSubmission,
    resolveConnector,
} from "@/lib/connectors/ingest";
import { genericWebhookParser } from "@/lib/connectors/parsers/generic-webhook";

const KIND = "generic-webhook";

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

function signatureValid(secret: string, rawBody: string, provided: string): boolean {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(provided.replace(/^sha256=/, ""));
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const limit = await ingestRateLimit(token, ip);
    if (!limit.allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { ...CORS, "Retry-After": String(limit.retryAfter) } },
        );
    }

    const rawText = await request.text();
    let payload: unknown;
    try {
        payload = JSON.parse(rawText);
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json(
            { error: "Body must be a JSON object" },
            { status: 400, headers: CORS },
        );
    }

    const connector = await resolveConnector(token, KIND);
    if (!connector) {
        return NextResponse.json({ error: "Invalid ingest token" }, { status: 401, headers: CORS });
    }
    if (!connector.is_active || !connector.website?.is_active) {
        return NextResponse.json(
            { error: "Connector or website is inactive" },
            { status: 403, headers: CORS },
        );
    }

    // Signature obligatoire sauf désactivation explicite par connecteur.
    const requireSignature = connector.config?.require_signature !== false;
    const signature = request.headers.get("x-signature");
    if (requireSignature && !signature) {
        return NextResponse.json(
            { error: "Missing signature (x-signature header required)" },
            { status: 401, headers: CORS },
        );
    }
    if (signature && !signatureValid(connector.signing_secret, rawText, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers: CORS });
    }

    const normalized = await genericWebhookParser.receive(payload, { headers: request.headers });
    const submissionId = await persistSubmission(connector, normalized);
    if (!submissionId) {
        return NextResponse.json(
            { error: "Failed to create submission" },
            { status: 500, headers: CORS },
        );
    }

    return NextResponse.json(
        { success: true, submission_id: submissionId },
        { status: 200, headers: { ...CORS, "X-RateLimit-Remaining": String(limit.remaining) } },
    );
}
