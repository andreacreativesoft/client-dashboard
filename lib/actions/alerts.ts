"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AlertType = "inactive_user" | "uncontacted_leads" | "broken_integration";
export type AlertSeverity = "warning" | "critical";

export type ClientAlert = {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    clientId?: string;
    clientName?: string;
    userId?: string;
    userName?: string;
    /** Days since the relevant event (inactivity / oldest lead). null = never. */
    days?: number | null;
    /** Number of items concerned (e.g. uncontacted leads). */
    count?: number;
    /** Integration type slug (ga4 / gbp / gsc) for broken_integration. */
    integrationType?: string;
    /** Whether a broken integration is due to an expired token. */
    isExpired?: boolean;
};

export async function getClientAlerts(): Promise<ClientAlert[]> {
    const auth = await requireAdmin();
    if (!auth.success) return [];

    const supabase = await createClient();
    const alerts: ClientAlert[] = [];

    // 1. Users who haven't logged in for 14+ days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: inactiveUsers } = await supabase
        .from("profiles")
        .select("id, full_name, email, last_login_at, role")
        .eq("role", "client")
        .or(`last_login_at.is.null,last_login_at.lt.${fourteenDaysAgo.toISOString()}`);

    if (inactiveUsers) {
        for (const user of inactiveUsers) {
            const daysSince = user.last_login_at
                ? Math.floor(
                      (Date.now() - new Date(user.last_login_at).getTime()) / (1000 * 60 * 60 * 24),
                  )
                : null;

            alerts.push({
                id: `inactive-${user.id}`,
                type: "inactive_user",
                severity: daysSince && daysSince > 30 ? "critical" : "warning",
                userId: user.id,
                userName: user.full_name || user.email,
                days: daysSince,
            });
        }
    }

    // 2. Leads received but not contacted (new status for 3+ days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    type LeadWithClient = {
        id: string;
        name: string | null;
        email: string | null;
        client_id: string;
        created_at: string;
        clients: { id: string; business_name: string };
    };

    const { data: uncontactedLeads } = await supabase
        .from("leads")
        .select(`
      id,
      name,
      email,
      client_id,
      created_at,
      clients!inner(id, business_name)
    `)
        .eq("status", "new")
        .lt("created_at", threeDaysAgo.toISOString())
        .overrideTypes<LeadWithClient[], { merge: false }>();

    if (uncontactedLeads) {
        // Group by client
        const leadsByClient: Record<
            string,
            { clientName: string; count: number; oldestDays: number }
        > = {};

        for (const lead of uncontactedLeads) {
            const daysSince = Math.floor(
                (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24),
            );

            if (!leadsByClient[lead.client_id]) {
                leadsByClient[lead.client_id] = {
                    clientName: lead.clients.business_name,
                    count: 0,
                    oldestDays: 0,
                };
            }
            const clientData = leadsByClient[lead.client_id];
            if (clientData) {
                clientData.count++;
                clientData.oldestDays = Math.max(clientData.oldestDays, daysSince);
            }
        }

        for (const [clientId, data] of Object.entries(leadsByClient)) {
            alerts.push({
                id: `uncontacted-${clientId}`,
                type: "uncontacted_leads",
                severity: data.oldestDays > 7 ? "critical" : "warning",
                clientId,
                clientName: data.clientName,
                count: data.count,
                days: data.oldestDays,
            });
        }
    }

    // 3. Broken integrations (inactive or expired tokens)
    type IntegrationWithClient = {
        id: string;
        type: string;
        account_name: string | null;
        is_active: boolean;
        token_expires_at: string | null;
        client_id: string;
        clients: { id: string; business_name: string };
    };

    const { data: brokenIntegrations } = await supabase
        .from("integrations")
        .select(`
      id,
      type,
      account_name,
      is_active,
      token_expires_at,
      client_id,
      clients!inner(id, business_name)
    `)
        .or(`is_active.eq.false,token_expires_at.lt.${new Date().toISOString()}`)
        .overrideTypes<IntegrationWithClient[], { merge: false }>();

    if (brokenIntegrations) {
        for (const integration of brokenIntegrations) {
            const isExpired =
                integration.token_expires_at && new Date(integration.token_expires_at) < new Date();

            alerts.push({
                id: `integration-${integration.id}`,
                type: "broken_integration",
                severity: "critical",
                clientId: integration.client_id,
                clientName: integration.clients.business_name,
                integrationType: integration.type,
                isExpired: Boolean(isExpired),
            });
        }
    }

    // Sort by severity (critical first) then by type
    return alerts.sort((a, b) => {
        if (a.severity === "critical" && b.severity !== "critical") return -1;
        if (a.severity !== "critical" && b.severity === "critical") return 1;
        return 0;
    });
}

export async function updateLastLogin(): Promise<void> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        await supabase
            .from("profiles")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", user.id);
    }
}
