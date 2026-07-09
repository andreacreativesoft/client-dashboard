/**
 * GET /api/auth/google/callback — retour du consentement Google (OAuth).
 * Auth : session Supabase + `state` base64 {clientId|null, userId, returnTo}.
 * Rate limit 10/min/IP. Échange le `code` contre des tokens (chiffrés AES-GCM),
 * identifie le compte Google (email via id_token), liste les ressources
 * disponibles (propriétés GA4 / locations GBP / sites GSC) et enregistre un
 * `connected_account` (les tokens vivent ici).
 *
 * clientId null = compte global/agence (admin uniquement). clientId renseigné =
 * compte spécifique client (admin, ou le client lui-même). La liaison ressource
 * ↔ site se fait ensuite dans la fiche client / les paramètres avancés.
 */
import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/actions/profile";
import {
    getTokensFromCode,
    encryptToken,
    decodeIdTokenEmail,
    missingDataScopes,
    REQUIRED_DATA_SCOPES,
    listGA4Properties,
    getGBPLocations,
    listGSCSites,
} from "@/lib/google";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/view-context";

/** N'accepte qu'un chemin interne comme cible de redirection (anti open-redirect). */
function safeReturnTo(value: unknown): string {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
        ? value
        : "/admin/connections";
}

export async function GET(request: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
    try {
        // Rate limit: 10 OAuth callbacks per minute per IP
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const limit = await rateLimit(`oauth-callback:${ip}`, {
            windowMs: 60_000,
            maxRequests: 10,
        });
        if (!limit.allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const code = request.nextUrl.searchParams.get("code");
        const state = request.nextUrl.searchParams.get("state");
        const oauthError = request.nextUrl.searchParams.get("error");

        if (oauthError) {
            console.error("Google OAuth error:", oauthError);
            return NextResponse.redirect(new URL("/admin/connections", appUrl));
        }
        if (!code || !state) {
            return NextResponse.redirect(new URL("/admin/connections", appUrl));
        }

        // Verify user is authenticated
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.redirect(new URL("/login", appUrl));
        }

        // Parse state
        let stateData: { clientId: string | null; userId: string; returnTo: string };
        try {
            const parsed = JSON.parse(Buffer.from(state, "base64").toString());
            if (!parsed.userId) throw new Error("Invalid state");
            stateData = {
                clientId: parsed.clientId ?? null,
                userId: parsed.userId,
                returnTo: safeReturnTo(parsed.returnTo),
            };
        } catch {
            return NextResponse.redirect(new URL("/admin/connections", appUrl));
        }

        const returnUrl = (params: string) => new URL(`${stateData.returnTo}?${params}`, appUrl);

        if (stateData.userId !== user.id) {
            return NextResponse.redirect(returnUrl("error=user_mismatch"));
        }

        // Autorisation serveur (le state ne fait pas foi seul) :
        // - compte global → admin uniquement ;
        // - compte spécifique → admin, ou le client propriétaire.
        const profile = await getProfile();
        const isAdmin = profile?.role === "admin";
        if (stateData.clientId === null) {
            if (!isAdmin) return NextResponse.redirect(returnUrl("error=forbidden"));
        } else if (!isAdmin) {
            const activeClientId = await getActiveClientId();
            if (activeClientId !== stateData.clientId) {
                return NextResponse.redirect(returnUrl("error=forbidden"));
            }
        }

        // Exchange code for tokens + identify the Google account.
        const tokens = await getTokensFromCode(code);
        const email = decodeIdTokenEmail(tokens.id_token);
        const grantedScopes = tokens.scope ? tokens.scope.split(" ") : REQUIRED_DATA_SCOPES;

        const missing = missingDataScopes(grantedScopes);
        if (missing.length > 0) {
            console.warn(
                `[google-oauth] Compte ${email ?? "?"} connecté avec des scopes insuffisants. ` +
                    `Manquants : ${missing.join(", ")}. Certaines données seront indisponibles.`,
            );
        }

        // List available resources across the three services (best-effort each).
        const [ga4Properties, gbpLocations, gscSites] = await Promise.all([
            listGA4Properties(tokens.access_token).catch((err) => {
                console.error("Failed to list GA4 properties:", err);
                return [];
            }),
            getGBPLocations(tokens.access_token).catch((err) => {
                console.error("Failed to list GBP locations:", err);
                return [];
            }),
            listGSCSites(tokens.access_token).catch((err) => {
                console.error("Failed to list GSC sites:", err);
                return [];
            }),
        ]);

        // Reconnexion : remplace le credential existant du même compte Google
        // dans le même périmètre (global ou ce client).
        const adminClient = createAdminClient();
        const dedup = adminClient
            .from("connected_accounts")
            .delete()
            .eq("provider", "google")
            .eq("external_account_id", email ?? "");
        await (stateData.clientId === null
            ? dedup.is("client_id", null)
            : dedup.eq("client_id", stateData.clientId));

        const { error: insertError } = await adminClient.from("connected_accounts").insert({
            client_id: stateData.clientId,
            created_by: user.id,
            provider: "google",
            external_account_id: email,
            external_account_label: email ?? "Google",
            access_token_encrypted: encryptToken(tokens.access_token),
            refresh_token_encrypted: encryptToken(tokens.refresh_token),
            token_expires_at: new Date(tokens.expiry_date).toISOString(),
            scopes: grantedScopes,
            metadata: { ga4Properties, gbpLocations, gscSites },
        });

        if (insertError) {
            console.error("Failed to save connected account:", insertError);
            return NextResponse.redirect(returnUrl("error=save_failed"));
        }

        return NextResponse.redirect(returnUrl("google=connected"));
    } catch (err) {
        console.error("Google callback error:", err instanceof Error ? err.message : err);
        if (process.env.NODE_ENV === "development") {
            console.error("Stack:", err instanceof Error ? err.stack : "no stack");
        }
        return NextResponse.redirect(new URL("/admin/connections?error=callback_failed", appUrl));
    }
}
