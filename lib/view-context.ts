import { redirect } from "next/navigation";

import { getProfile } from "@/lib/actions/profile";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type ViewMode = "agency" | "client";

export interface ViewContext {
    profile: Profile;
    /** Real account role — true even while an admin is impersonating a client. */
    isAdmin: boolean;
    /**
     * "agency" when an admin browses their own agency space (no impersonation).
     * "client" for a real client, or for an admin impersonating one.
     */
    mode: ViewMode;
    /** The client an admin is currently impersonating, if any. */
    impersonatedClientId: string | null;
}

/**
 * Resolves the current view context for a signed-in user.
 *
 * The app has two mutually exclusive spaces:
 * - **agency** — admin-only management views (clients, users, websites).
 * - **client** — the business-facing dashboard (analytics, leads, requests…),
 *   seen either by a real client or by an admin who entered a client via impersonation.
 *
 * Redirects to /login when there is no authenticated profile.
 */
export async function getViewContext(): Promise<ViewContext> {
    const profile = await getProfile();
    if (!profile) redirect("/login");

    const isAdmin = profile.role === "admin";
    const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;
    const mode: ViewMode = isAdmin && !impersonatedClientId ? "agency" : "client";

    return { profile, isAdmin, mode, impersonatedClientId };
}

/**
 * Resolves the single client the current user is acting for — the **one**
 * source of truth for client-scoping (replaces the previous divergent ad-hoc
 * resolutions).
 *
 * - **admin** → the client they are impersonating, or `null` in agency mode.
 * - **client** → their own client. The product model is **one account = one
 *   business** (enforced by a `unique (user_id)` constraint on `client_users`),
 *   so there is exactly one row; `limit(1)` is a defensive belt, not a choice.
 */
export async function getActiveClientId(): Promise<string | null> {
    const profile = await getProfile();
    if (!profile) return null;
    if (profile.role === "admin") return getImpersonatedClientId();

    const supabase = await createClient();
    const { data } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();
    return data?.client_id ?? null;
}

/**
 * Guard for client-facing routes (analytics, leads, requests, dashboard…).
 * An admin in agency mode has no business data of their own, so they are sent
 * back to the agency space — they must impersonate a client to see these views.
 */
export async function requireClientView(): Promise<ViewContext> {
    const ctx = await getViewContext();
    if (ctx.mode === "agency") redirect("/admin");
    return ctx;
}

/**
 * Guard for agency-only routes (/admin/*).
 * Blocks real clients and admins who are currently impersonating a client
 * (they must exit impersonation to manage the agency again).
 */
export async function requireAgencyView(): Promise<ViewContext> {
    const ctx = await getViewContext();
    if (ctx.mode !== "agency") redirect("/dashboard");
    return ctx;
}
