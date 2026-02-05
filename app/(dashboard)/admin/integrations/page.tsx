import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationCard } from "./integration-card";
import { FacebookPixelForm } from "./facebook-pixel-form";

export const metadata: Metadata = {
  title: "Integrations",
};

type Integration = {
  id: string;
  client_id: string;
  type: string;
  account_id: string;
  account_name: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  clients: { business_name: string } | null;
};

async function getIntegrations() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("integrations")
    .select("id, client_id, type, account_id, account_name, is_active, metadata, clients(business_name)")
    .order("created_at", { ascending: false })
    .returns<Integration[]>();

  return data || [];
}

async function getClients() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("id, business_name")
    .order("business_name");

  return data || [];
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; type?: string; client_id?: string }>;
}) {
  const params = await searchParams;
  const integrations = await getIntegrations();
  const clients = await getClients();

  const ga4Integrations = integrations.filter((i) => i.type === "ga4");
  const gbpIntegrations = integrations.filter((i) => i.type === "gbp");
  const fbIntegrations = integrations.filter((i) => i.type === "facebook");

  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Integrations</h1>

      {params.success && (
        <div className="mb-4 rounded-lg border border-success/50 bg-success/10 p-3 text-sm text-success">
          Google {params.type === "ga4" ? "Analytics" : "Business Profile"} connected successfully.
        </div>
      )}

      {params.error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to connect: {params.error.replace(/_/g, " ")}
        </div>
      )}

      {!googleConfigured && (
        <div className="mb-4 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
          Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable integrations.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* GA4 Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.84 2.998c-.648-.644-1.712-.644-2.36 0L4.22 19.26c-.648.644-.648 1.692 0 2.336.324.324.756.504 1.18.504.424 0 .856-.18 1.18-.504L22.84 5.334c.648-.644.648-1.692 0-2.336z"/>
                <path d="M3.54 7.152a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08zM20.46 24a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08z"/>
              </svg>
              Google Analytics (GA4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ga4Integrations.length > 0 ? (
              <div className="space-y-3">
                {ga4Integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    clientName={integration.clients?.business_name || "Unknown"}
                  />
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                No GA4 integrations connected yet.
              </p>
            )}

            {googleConfigured && clients.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium">Connect for client:</p>
                <div className="flex flex-wrap gap-2">
                  {clients.map((client) => (
                    <a
                      key={client.id}
                      href={`/api/auth/google?client_id=${client.id}&type=ga4`}
                      className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                      {client.business_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GBP Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Google Business Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gbpIntegrations.length > 0 ? (
              <div className="space-y-3">
                {gbpIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    clientName={integration.clients?.business_name || "Unknown"}
                  />
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                No Google Business Profile integrations connected yet.
              </p>
            )}

            {googleConfigured && clients.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium">Connect for client:</p>
                <div className="flex flex-wrap gap-2">
                  {clients.map((client) => (
                    <a
                      key={client.id}
                      href={`/api/auth/google?client_id=${client.id}&type=gbp`}
                      className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                      {client.business_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facebook Pixel / Conversions API */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook Pixel / Conversions API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect Facebook Pixel to track lead conversions in Facebook Ads Manager. When a lead comes in, it will be sent to Facebook as a Lead conversion event.
            </p>

            {fbIntegrations.length > 0 && (
              <div className="mb-4 space-y-3">
                {fbIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    clientName={integration.clients?.business_name || "Unknown"}
                  />
                ))}
              </div>
            )}

            {clients.length > 0 && (
              <FacebookPixelForm clients={clients} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
