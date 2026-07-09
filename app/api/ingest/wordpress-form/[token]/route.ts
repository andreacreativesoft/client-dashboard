/**
 * Endpoint dédié au connecteur `wordpress-form`.
 * Taillé pour les plugins de formulaire WordPress (Elementor, WPForms, CF7…),
 * qui POSTent du `application/x-www-form-urlencoded` ou du JSON. Pas de signature
 * exigée : ces plugins ne savent pas signer — le token (en chemin) fait foi.
 * L'installation côté client = coller l'URL dans l'action du formulaire.
 */
import { NextRequest, NextResponse } from "next/server";

import {
    INGEST_CORS_HEADERS as CORS,
    ingestRateLimit,
    persistSubmission,
    resolveConnector,
} from "@/lib/connectors/ingest";
import { wordpressFormParser } from "@/lib/connectors/parsers/wordpress-form";

const KIND = "wordpress-form";

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
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

    // Les plugins WP postent surtout du form-urlencoded ; on accepte aussi le JSON.
    const contentType = request.headers.get("content-type") || "";
    let payload: unknown;
    try {
        if (contentType.includes("application/json")) {
            payload = await request.json();
        } else {
            payload = Object.fromEntries(new URLSearchParams(await request.text()));
        }
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json(
            { error: "Body must be an object" },
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

    const normalized = await wordpressFormParser.receive(payload, { headers: request.headers });
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
