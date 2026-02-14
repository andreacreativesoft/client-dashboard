"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WebsiteForm } from "./website-form";
import { InfoBoard } from "./info-board";
import { deleteWebsiteAction, regenerateApiKeyAction, acknowledgeChangesAction } from "@/lib/actions/websites";
import { addFacebookIntegration, deleteIntegration } from "@/lib/actions/integrations";
import { timeAgo } from "@/lib/utils";
import type { Website, Integration } from "@/types/database";

interface WebsitesListProps {
  clientId: string;
  websites: Website[];
  integrations: Integration[];
  googleConfigured: boolean;
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

  const needsSelection =
    integration.metadata?.needsPropertySelection ||
    integration.metadata?.needsLocationSelection;

  const typeLabel =
    integration.type === "facebook"
      ? "Facebook Pixel"
      : integration.type === "ga4"
        ? "GA4"
        : "GBP";

  async function handleDelete() {
    if (!confirm(`Remove this ${typeLabel} integration?`)) return;
    setDeleting(true);
    await deleteIntegration(integration.id, clientId);
    router.refresh();
  }

  return (
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
          <Badge variant="secondary" className="text-[10px]">Setup</Badge>
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
}: {
  clientId: string;
  integrations: Integration[];
  googleConfigured: boolean;
}) {
  const [showFbForm, setShowFbForm] = useState(false);

  const ga4 = integrations.filter((i) => i.type === "ga4");
  const gbp = integrations.filter((i) => i.type === "gbp");
  const fb = integrations.filter((i) => i.type === "facebook");

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        Integrations
      </p>

      <div className="space-y-1.5">
        {/* Existing integrations */}
        {[...ga4, ...gbp, ...fb].map((i) => (
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
        {!googleConfigured && ga4.length === 0 && gbp.length === 0 && (
          <div className="mt-2 rounded border border-dashed border-border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium">Google Integrations Unavailable</p>
            <p className="text-xs text-muted-foreground">
              GA4 and Google Business Profile require Google OAuth to be configured.
              Add these to your <code className="rounded bg-background px-1 py-0.5 text-[10px]">.env.local</code> file and restart the server:
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>1. Go to <span className="font-medium text-foreground">Google Cloud Console</span> &rarr; APIs &amp; Services &rarr; Credentials</li>
              <li>2. Create an <span className="font-medium text-foreground">OAuth 2.0 Client ID</span> (Web application)</li>
              <li>3. Set redirect URI to <code className="rounded bg-background px-1 py-0.5 text-[10px]">{"http://localhost:3000/api/auth/google/callback"}</code></li>
              <li>4. Enable APIs: <span className="font-medium text-foreground">Analytics Data API</span>, <span className="font-medium text-foreground">Analytics Admin API</span>, <span className="font-medium text-foreground">My Business Account Management</span>, <span className="font-medium text-foreground">My Business Business Information</span></li>
              <li>5. Add to <code className="rounded bg-background px-1 py-0.5 text-[10px]">.env.local</code>:</li>
            </ol>
            <pre className="mt-1.5 overflow-x-auto rounded bg-background p-2 text-[10px] leading-relaxed">
{`GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
TOKEN_ENCRYPTION_KEY=any-32-char-random-string`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function WebsitesList({ clientId, websites, integrations, googleConfigured }: WebsitesListProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

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

  async function handleCheckChanges(website: Website) {
    setCheckingId(website.id);
    try {
      const res = await fetch("/api/check-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: website.id }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else if (data.hasChanges) {
        alert("Changes detected on the live website! Review before pushing local changes.");
      } else if (data.isFirstCheck) {
        alert("Baseline snapshot saved. Future checks will detect changes.");
      } else {
        alert("No changes detected. Safe to proceed.");
      }
      router.refresh();
    } catch {
      alert("Failed to check website");
    }
    setCheckingId(null);
  }

  async function handleAcknowledge(websiteId: string) {
    const result = await acknowledgeChangesAction(websiteId);
    if (!result.success) {
      alert(result.error || "Failed to acknowledge");
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{website.name}</h4>
                        <Badge variant={website.is_active ? "default" : "secondary"}>
                          {website.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {website.has_changes && (
                          <Badge variant="destructive" className="animate-pulse">
                            Changed
                          </Badge>
                        )}
                      </div>
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-muted-foreground hover:underline"
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

                  {/* Change Detection */}
                  <div className={`mt-3 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center ${website.has_changes ? "border-destructive bg-destructive/5" : "border-border bg-muted/50"}`}>
                    <div className="flex-1 text-xs text-muted-foreground">
                      {website.has_changes ? (
                        <span className="font-medium text-destructive">
                          Live website has changed since last check
                        </span>
                      ) : website.last_checked_at ? (
                        <>Last checked {timeAgo(website.last_checked_at)}</>
                      ) : (
                        "Never checked for changes"
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {website.has_changes && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(website.id)}
                          className="h-9 flex-1 text-xs sm:h-7 sm:flex-none"
                        >
                          Dismiss
                        </Button>
                      )}
                      <Button
                        variant={website.has_changes ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleCheckChanges(website)}
                        disabled={checkingId === website.id}
                        className="h-9 flex-1 text-xs sm:h-7 sm:flex-none"
                      >
                        {checkingId === website.id ? "Checking..." : "Check Changes"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-muted p-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      API Key (for webhook)
                    </p>
                    <code className="mb-2 block truncate rounded bg-background px-2 py-1 text-xs">
                      {website.api_key}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 sm:h-8 sm:flex-none"
                        onClick={() => handleCopyApiKey(website)}
                      >
                        {copiedId === website.id ? "Copied!" : "Copy Key"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 flex-1 sm:h-8 sm:flex-none"
                        onClick={() => handleRegenerateKey(website)}
                      >
                        Regenerate
                      </Button>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      Webhook: {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/lead?key={website.api_key}
                    </p>
                  </div>

                  {/* Integrations for this website/client */}
                  <WebsiteIntegrations
                    clientId={clientId}
                    integrations={integrations}
                    googleConfigured={googleConfigured}
                  />

                  {/* Project Links */}
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Project Links
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        <span className="text-xs font-medium">Git:</span>
                        {website.git_repo_url ? (
                          <a href={website.git_repo_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                            {website.git_repo_url}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.78 12.653c-2.768 0-5.013 2.245-5.013 5.013s2.245 5.013 5.013 5.013 5.013-2.245 5.013-5.013-2.245-5.013-5.013-5.013zm-13.56 0c-2.768 0-5.013 2.245-5.013 5.013s2.245 5.013 5.013 5.013 5.013-2.245 5.013-5.013-2.245-5.013-5.013-5.013zM12 1.321c-2.768 0-5.013 2.245-5.013 5.013S9.232 11.347 12 11.347s5.013-2.245 5.013-5.013S14.768 1.321 12 1.321z" />
                        </svg>
                        <span className="text-xs font-medium">Asana:</span>
                        {website.asana_project_url ? (
                          <a href={website.asana_project_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                            {website.asana_project_url}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4zm0-20C5.792 4 4 5.792 4 8s1.792 4 4 4h4V4H8zM8 0C5.792 0 4 1.792 4 4s1.792 4 4 4h4V0H8zm8 0h-4v8h4c2.208 0 4-1.792 4-4s-1.792-4-4-4zm0 12c-2.208 0-4 1.792-4 4s1.792 4 4 4 4-1.792 4-4-1.792-4-4-4z" />
                        </svg>
                        <span className="text-xs font-medium">Figma:</span>
                        {website.figma_url ? (
                          <a href={website.figma_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                            {website.figma_url}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info Board */}
                  <InfoBoard websiteId={website.id} />
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
