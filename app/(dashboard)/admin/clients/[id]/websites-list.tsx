"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WebsiteForm } from "./website-form";
import { Modal } from "@/components/ui/modal";
import { deleteWebsiteAction, regenerateApiKeyAction } from "@/lib/actions/websites";
import { addFacebookIntegration, deleteIntegration, selectIntegrationAccount } from "@/lib/actions/integrations";
import type { Website, Integration } from "@/types/database";

interface WebsitesListProps {
  clientId: string;
  websites: Website[];
  integrations: Integration[];
  googleConfigured: boolean;
  appUrl: string;
}

function AccountSelectionModal({
  integration,
  clientId,
  onClose,
}: {
  integration: Integration;
  clientId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualLocationId, setManualLocationId] = useState("");
  const [manualLocationName, setManualLocationName] = useState("");

  const metadata = integration.metadata as Record<string, unknown> | null;
  const isGA4 = integration.type === "ga4";
  const isGSC = integration.type === "gsc";

  // GA4 properties from metadata
  const properties = (metadata?.properties as Array<{
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>) || [];

  // GBP locations from metadata
  const locations = (metadata?.locations as Array<{
    accountId: string;
    accountName: string;
    locationId: string;
    locationName: string;
  }>) || [];

  // GSC sites from metadata
  const sites = (metadata?.sites as Array<{
    siteUrl: string;
    permissionLevel: string;
  }>) || [];

  async function handleSelect(accountId: string, accountName: string) {
    setSaving(true);
    setError(null);
    const result = await selectIntegrationAccount(
      integration.id,
      accountId,
      accountName,
      clientId
    );
    setSaving(false);

    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error || "Failed to save selection");
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualLocationId.trim()) {
      setError("Location ID is required");
      return;
    }
    await handleSelect(
      manualLocationId.trim(),
      manualLocationName.trim() || `Location ${manualLocationId.trim()}`
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isGA4 ? "Select GA4 Property" : isGSC ? "Select Search Console Site" : "Select Business Location"}
    >
      <div className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {isGA4 ? (
          properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No GA4 properties found for this Google account. Make sure the account has access to Google Analytics.
            </p>
          ) : (
            properties.map((account) => (
              <div key={account.account || account.displayName} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {account.displayName || account.account}
                </p>
                {(account.propertySummaries || []).map((prop) => {
                  const propertyId = prop.property?.replace("properties/", "") || "";
                  return (
                    <button
                      key={prop.property}
                      onClick={() => handleSelect(propertyId, prop.displayName || propertyId)}
                      disabled={saving}
                      className="w-full rounded border border-border p-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="font-medium">{prop.displayName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{propertyId}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )
        ) : isGSC ? (
          sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No verified sites found in Search Console. Make sure the Google account has verified sites in Google Search Console.
            </p>
          ) : (
            sites.map((site) => (
              <button
                key={site.siteUrl}
                onClick={() => handleSelect(site.siteUrl, site.siteUrl)}
                disabled={saving}
                className="w-full rounded border border-border p-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                <span className="font-medium">{site.siteUrl}</span>
                <span className="ml-2 text-xs text-muted-foreground">{site.permissionLevel}</span>
              </button>
            ))
          )
        ) : locations.length > 0 ? (
          locations.map((loc) => (
            <button
              key={`${loc.accountId}-${loc.locationId}`}
              onClick={() => handleSelect(loc.locationId, loc.locationName)}
              disabled={saving}
              className="w-full rounded border border-border p-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium">{loc.locationName}</span>
              <span className="ml-2 text-xs text-muted-foreground">{loc.accountName}</span>
            </button>
          ))
        ) : !showManualInput ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Could not auto-discover locations. This happens when the Google Business Profile API access is pending approval.
            </p>
            <Button
              size="sm"
              onClick={() => setShowManualInput(true)}
              className="w-full"
            >
              Enter Location ID Manually
            </Button>
          </div>
        ) : null}

        {/* Manual location ID input for GBP */}
        {!isGA4 && (showManualInput || locations.length > 0) && (
          <form onSubmit={handleManualSubmit} className="space-y-2 rounded border border-border p-3">
            {locations.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground">Or enter manually:</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="manual_location_id" className="text-xs">Location ID</Label>
              <Input
                id="manual_location_id"
                value={manualLocationId}
                onChange={(e) => setManualLocationId(e.target.value)}
                required
                placeholder="e.g. 12345678901234567"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Find it at business.google.com → select your business → the number in the URL
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual_location_name" className="text-xs">Business Name</Label>
              <Input
                id="manual_location_name"
                value={manualLocationName}
                onChange={(e) => setManualLocationName(e.target.value)}
                placeholder="e.g. Healing Therapy București"
                className="h-8 text-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={saving} className="h-7 w-full text-xs">
              {saving ? "Saving..." : "Save Location"}
            </Button>
          </form>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IntegrationItem({
  integration,
  clientId,
}: {
  integration: Integration;
  clientId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showSelection, setShowSelection] = useState(false);

  const needsSelection =
    integration.metadata?.needsPropertySelection ||
    integration.metadata?.needsLocationSelection ||
    integration.metadata?.needsSiteSelection;

  const typeLabel =
    integration.type === "facebook"
      ? "Facebook Pixel"
      : integration.type === "ga4"
        ? "GA4"
        : integration.type === "gsc"
          ? "GSC"
          : "GBP";

  async function handleDelete() {
    if (!confirm(`Remove this ${typeLabel} integration?`)) return;
    setDeleting(true);
    await deleteIntegration(integration.id, clientId);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between rounded border p-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {typeLabel}:{" "}
            {needsSelection
              ? "Setup required"
              : integration.account_name || integration.account_id}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {needsSelection ? (
            <button
              onClick={() => setShowSelection(true)}
              className="cursor-pointer"
            >
              <Badge variant="secondary" className="cursor-pointer text-[10px] hover:bg-muted-foreground/20">Setup</Badge>
            </button>
          ) : integration.is_active ? (
            <Badge variant="default" className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
            title="Remove"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showSelection && (
        <AccountSelectionModal
          integration={integration}
          clientId={clientId}
          onClose={() => setShowSelection(false)}
        />
      )}
    </>
  );
}

function FacebookPixelForm({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const pixelId = (form.elements.namedItem("pixel_id") as HTMLInputElement).value;
    const accessToken = (form.elements.namedItem("access_token") as HTMLInputElement).value;
    const testEventCode = (form.elements.namedItem("test_event_code") as HTMLInputElement).value;

    const result = await addFacebookIntegration(
      clientId,
      pixelId,
      accessToken,
      testEventCode || undefined
    );

    setLoading(false);

    if (result.success) {
      onDone();
      router.refresh();
    } else {
      setError(result.error || "Failed to add integration");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-border p-3">
      <p className="text-xs font-medium">Add Facebook Pixel</p>
      <div className="space-y-1">
        <Label htmlFor="pixel_id" className="text-xs">Pixel ID</Label>
        <Input id="pixel_id" name="pixel_id" required placeholder="123456789012345" className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="access_token" className="text-xs">Access Token</Label>
        <Input id="access_token" name="access_token" type="password" required placeholder="EAAxxxxxxx..." className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="test_event_code" className="text-xs">Test Event Code (optional)</Label>
        <Input id="test_event_code" name="test_event_code" placeholder="TEST12345" className="h-8 text-xs" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading} className="h-7 text-xs">
          {loading ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone} className="h-7 text-xs">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function WebsiteIntegrations({
  clientId,
  integrations,
  googleConfigured,
  appUrl,
}: {
  clientId: string;
  integrations: Integration[];
  googleConfigured: boolean;
  appUrl: string;
}) {
  const [showFbForm, setShowFbForm] = useState(false);

  const ga4 = integrations.filter((i) => i.type === "ga4");
  const gbp = integrations.filter((i) => i.type === "gbp");
  const gsc = integrations.filter((i) => i.type === "gsc");
  const fb = integrations.filter((i) => i.type === "facebook");

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        Integrations
      </p>

      <div className="space-y-1.5">
        {/* Existing integrations */}
        {[...ga4, ...gbp, ...gsc, ...fb].map((i) => (
          <IntegrationItem key={i.id} integration={i} clientId={clientId} />
        ))}

        {/* Connect buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ga4.length === 0 && googleConfigured && (
            <a
              href={`/api/auth/google?client_id=${clientId}&type=ga4`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.84 2.998c-.648-.644-1.712-.644-2.36 0L4.22 19.26c-.648.644-.648 1.692 0 2.336.324.324.756.504 1.18.504.424 0 .856-.18 1.18-.504L22.84 5.334c.648-.644.648-1.692 0-2.336z" />
                <path d="M3.54 7.152a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08zM20.46 24a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08z" />
              </svg>
              Connect GA4
            </a>
          )}
          {gbp.length === 0 && googleConfigured && (
            <a
              href={`/api/auth/google?client_id=${clientId}&type=gbp`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              Connect GBP
            </a>
          )}
          {gsc.length === 0 && googleConfigured && (
            <a
              href={`/api/auth/google?client_id=${clientId}&type=gsc`}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              Connect GSC
            </a>
          )}
          {!showFbForm && (
            <button
              onClick={() => setShowFbForm(true)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {fb.length > 0 ? "Add Pixel" : "Add Facebook Pixel"}
            </button>
          )}
        </div>

        {showFbForm && (
          <FacebookPixelForm
            clientId={clientId}
            onDone={() => setShowFbForm(false)}
          />
        )}

        {/* Show setup guidance when Google OAuth is not configured */}
        {!googleConfigured && ga4.length === 0 && gbp.length === 0 && gsc.length === 0 && (
          <div className="mt-2 rounded border border-dashed border-border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium">Google Integrations Unavailable</p>
            <p className="text-xs text-muted-foreground">
              GA4 and Google Business Profile require Google OAuth to be configured.
              Add these environment variables in your <span className="font-medium text-foreground">Vercel project settings</span> (Settings &rarr; Environment Variables) and redeploy:
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>1. Go to <span className="font-medium text-foreground">Google Cloud Console</span> &rarr; APIs &amp; Services &rarr; Credentials</li>
              <li>2. Create an <span className="font-medium text-foreground">OAuth 2.0 Client ID</span> (Web application)</li>
              <li>3. Set redirect URI to <code className="rounded bg-background px-1 py-0.5 text-[10px]">{`${appUrl}/api/auth/google/callback`}</code></li>
              <li>4. Enable APIs: <span className="font-medium text-foreground">Analytics Data API</span>, <span className="font-medium text-foreground">Analytics Admin API</span>, <span className="font-medium text-foreground">Search Console API</span>, <span className="font-medium text-foreground">My Business Account Management</span>, <span className="font-medium text-foreground">My Business Business Information</span></li>
              <li>5. Add these environment variables:</li>
            </ol>
            <pre className="mt-1.5 overflow-x-auto rounded bg-background p-2 text-[10px] leading-relaxed">
{`GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=${appUrl}/api/auth/google/callback
TOKEN_ENCRYPTION_KEY=any-32-char-random-string`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function WebsitesList({ clientId, websites, integrations, googleConfigured, appUrl }: WebsitesListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleEdit(website: Website) {
    setEditingWebsite(website);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditingWebsite(null);
  }

  async function handleDelete(website: Website) {
    if (!confirm(`Delete "${website.name}"? This will also delete all leads from this website.`)) {
      return;
    }

    const result = await deleteWebsiteAction(website.id);
    if (!result.success) {
      alert(result.error || "Failed to delete website");
    }
  }

  async function handleCopyApiKey(website: Website) {
    await navigator.clipboard.writeText(website.api_key);
    setCopiedId(website.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleRegenerateKey(website: Website) {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) {
      return;
    }

    const result = await regenerateApiKeyAction(website.id);
    if (!result.success) {
      alert(result.error || "Failed to regenerate key");
    } else if (result.apiKey) {
      await navigator.clipboard.writeText(result.apiKey);
      alert("New API key copied to clipboard!");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Websites</CardTitle>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            Add Website
          </Button>
        </CardHeader>
        <CardContent>
          {websites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No websites yet. Add a website to start receiving leads.
            </p>
          ) : (
            <div className="space-y-4">
              {websites.map((website) => (
                <div
                  key={website.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{website.name}</h4>
                        <Badge variant={website.is_active ? "default" : "secondary"}>
                          {website.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:underline"
                      >
                        {website.url}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: {website.source_type}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(website)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(website)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-muted p-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      API Key (for webhook)
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1 text-xs">
                        {website.api_key}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyApiKey(website)}
                      >
                        {copiedId === website.id ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateKey(website)}
                      >
                        Regenerate
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Webhook URL: {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/lead?key={website.api_key}
                    </p>
                  </div>

                  {/* Integrations for this website/client */}
                  <WebsiteIntegrations
                    clientId={clientId}
                    integrations={integrations}
                    googleConfigured={googleConfigured}
                    appUrl={appUrl}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WebsiteForm
        open={formOpen}
        onClose={handleClose}
        clientId={clientId}
        website={editingWebsite}
      />
    </>
  );
}
