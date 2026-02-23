"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  connectWordPress,
  disconnectWordPress,
  testExistingConnection,
  deployMuPluginAction,
} from "@/lib/actions/wordpress-manage";

// ─── Connected State ─────────────────────────────────────────────────

interface ConnectedProps {
  websiteId: string;
  siteUrl: string;
  muPluginInstalled: boolean;
  muPluginVersion?: string;
  lastHealthCheck?: string;
  connectedAt?: string;
}

function ConnectedState({
  websiteId,
  siteUrl,
  muPluginInstalled,
  muPluginVersion,
  lastHealthCheck,
  connectedAt,
}: ConnectedProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testExistingConnection(websiteId);
      if (result.success) {
        setTestResult({ type: "success", message: "Connection OK" });
      } else {
        setTestResult({ type: "error", message: result.error || "Connection failed" });
      }
    });
  }

  function handleDisconnect() {
    if (!confirm("Disconnect WordPress? This will remove all stored credentials.")) return;
    setDisconnecting(true);
    startTransition(async () => {
      const result = await disconnectWordPress(websiteId);
      setDisconnecting(false);
      if (result.success) {
        router.refresh();
      } else {
        setTestResult({ type: "error", message: result.error || "Failed to disconnect" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">WordPress Connection</CardTitle>
          <Badge variant="default" className="text-xs">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Site URL</span>
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {siteUrl}
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">mu-plugin</span>
            <span className="flex items-center gap-1.5">
              {muPluginInstalled ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Installed{muPluginVersion ? ` (v${muPluginVersion})` : ""}
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Not installed
                </>
              )}
            </span>
          </div>
          {connectedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connected</span>
              <span>{new Date(connectedAt).toLocaleDateString()}</span>
            </div>
          )}
          {lastHealthCheck && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last health check</span>
              <span>{new Date(lastHealthCheck).toLocaleString()}</span>
            </div>
          )}
        </div>

        {!muPluginInstalled && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              mu-plugin not installed
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              The mu-plugin is required for debug logs, site health, cache clearing, and advanced features.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setDeploying(true);
                  setTestResult(null);
                  startTransition(async () => {
                    const result = await deployMuPluginAction(websiteId);
                    setDeploying(false);
                    if (result.success) {
                      setTestResult({ type: "success", message: result.message });
                      router.refresh();
                    } else {
                      setTestResult({ type: "error", message: result.message });
                    }
                  });
                }}
              >
                {deploying ? "Deploying..." : "Deploy via SSH"}
              </Button>
              <a
                href="/mu-plugins/dashboard-connector.php"
                download="dashboard-connector.php"
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Plugin
              </a>
            </div>
          </div>
        )}

        {testResult && (
          <p
            className={`text-sm ${
              testResult.type === "success" ? "text-green-600" : "text-destructive"
            }`}
          >
            {testResult.message}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending}
          >
            {isPending && !disconnecting && !deploying ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isPending}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Connect Form ────────────────────────────────────────────────────

interface ConnectFormProps {
  websiteId: string;
  siteUrl: string;
}

function ConnectForm({ websiteId, siteUrl }: ConnectFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(siteUrl.replace(/\/+$/, ""));
  const [sharedSecret, setSharedSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Success state
  const [connectResult, setConnectResult] = useState<{
    mu_plugin_installed: boolean;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await connectWordPress({
        website_id: websiteId,
        site_url: url,
        shared_secret: sharedSecret,
      });

      if (result.success) {
        setConnectResult({
          mu_plugin_installed: result.mu_plugin_installed!,
        });
      } else {
        setError(result.error || "Failed to connect");
      }
    });
  }

  // After successful connection
  if (connectResult) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">WordPress Connected</CardTitle>
            <Badge variant="default" className="text-xs">Success</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Connected to <strong>{url}</strong> via shared secret.
          </p>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">mu-plugin:</span>
            {connectResult.mu_plugin_installed ? (
              <Badge variant="default" className="text-xs">Installed</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Not installed</Badge>
            )}
          </div>

          {!connectResult.mu_plugin_installed && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                The mu-plugin is required for all features. Upload it first, then reconnect.
              </p>
              <a
                href="/mu-plugins/dashboard-connector.php"
                download="dashboard-connector.php"
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Plugin
              </a>
            </div>
          )}

          <Button size="sm" onClick={() => router.refresh()}>
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Connect WordPress</CardTitle>
          <Badge variant="outline" className="text-xs">
            Requires mu-plugin
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wp_site_url">Site URL</Label>
            <Input
              id="wp_site_url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wp_secret">Shared Secret</Label>
            <Input
              id="wp_secret"
              type="password"
              value={sharedSecret}
              onChange={(e) => setSharedSecret(e.target.value)}
              required
              placeholder="Paste the secret from WordPress Settings → Dashboard Connector"
            />
            <p className="text-xs text-muted-foreground">
              WordPress Admin &rarr; Settings &rarr; Dashboard Connector &rarr; copy the Shared Secret
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={isPending || !url || !sharedSecret}
          >
            {isPending ? "Connecting..." : "Connect"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface ConnectWordPressFormProps {
  websiteId: string;
  siteUrl: string;
  status: {
    connected: boolean;
    integration_id?: string;
    site_url?: string;
    username?: string;
    mu_plugin_installed?: boolean;
    mu_plugin_version?: string;
    last_health_check?: string;
    connected_at?: string;
  };
}

export function ConnectWordPressForm({
  websiteId,
  siteUrl,
  status,
}: ConnectWordPressFormProps) {
  if (status.connected) {
    return (
      <ConnectedState
        websiteId={websiteId}
        siteUrl={status.site_url || siteUrl}
        muPluginInstalled={status.mu_plugin_installed || false}
        muPluginVersion={status.mu_plugin_version}
        lastHealthCheck={status.last_health_check}
        connectedAt={status.connected_at}
      />
    );
  }

  return <ConnectForm websiteId={websiteId} siteUrl={siteUrl} />;
}
