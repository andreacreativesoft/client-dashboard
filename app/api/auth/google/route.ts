/**
 * GET /api/auth/google — initie le flux OAuth Google (GA4 + GBP + GSC en une
 * connexion). Auth : session Supabase requise (sinon → /login). Rate limit 10/min/IP.
 *
 * Deux types de comptes selon l'acteur :
 * - **admin** : `?client_id=…` connecte un compte **spécifique** à ce client ;
 *   `?scope=global` (ou aucun client_id) connecte un compte **global/agence**
 *   (liable à n'importe quel site, invisible aux clients).
 * - **client** : le `client_id` est dérivé de son profil ; il ne peut créer que
 *   des comptes spécifiques à son propre commerce.
 *
 * L'état encode {clientId|null, userId, returnTo} et le retour arrive sur
 * /api/auth/google/callback.
 */
import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/actions/profile";
import { getAuthUrl } from "@/lib/google";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/view-context";

export async function GET(request: NextRequest) {
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;

        // Rate limit: 10 OAuth initiations per minute per IP
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const limit = await rateLimit(`oauth:${ip}`, { windowMs: 60_000, maxRequests: 10 });
        if (!limit.allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.redirect(new URL("/login", appUrl));
        }

        const profile = await getProfile();
        const isAdmin = profile?.role === "admin";
        const requestedClientId = request.nextUrl.searchParams.get("client_id");
        const wantsGlobal = request.nextUrl.searchParams.get("scope") === "global";

        // Résout (clientId, returnTo) selon l'acteur.
        let clientId: string | null;
        let returnTo: string;

        if (isAdmin) {
            if (wantsGlobal || !requestedClientId) {
                clientId = null; // compte global/agence
                returnTo = "/admin/connections";
            } else {
                clientId = requestedClientId; // compte spécifique à ce client
                returnTo = `/admin/clients/${requestedClientId}`;
            }
        } else {
            // Client : toujours son propre commerce, jamais de compte global.
            clientId = await getActiveClientId();
            if (!clientId) {
                return NextResponse.redirect(
                    new URL("/settings/connections?error=no_client", appUrl),
                );
            }
            returnTo = "/settings/connections";
        }

        const state = Buffer.from(JSON.stringify({ clientId, userId: user.id, returnTo })).toString(
            "base64",
        );

        return NextResponse.redirect(getAuthUrl(state));
    } catch (err) {
        console.error("Google auth error:", err instanceof Error ? err.message : err);
        return NextResponse.json({ error: "Failed to initiate Google auth" }, { status: 500 });
    }
}
