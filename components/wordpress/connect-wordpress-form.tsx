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
  diagnoseConnectionAction,
  deployMuPluginAction,
  revealAppPassword,
} from "@/lib/actions/wordpress-manage";
import type { ConnectionDiagnostics, DiagnosticStep } from "@/lib/wordpress/wp-client";

// ─── Connected State ─────────────────────────────────────────────────

interface ConnectedProps {
  websiteId: string;
  siteUrl: string;
  username: string;
  muPluginInstalled: boolean;
  muPluginVersion?: string;
  lastHealthCheck?: string;
  connectedAt?: string;
}

function ConnectedState({
  websiteId,
  siteUrl,
  username,
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
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  function handleDiagnose() {
    setTestResult(null);
    setDiagnostics(null);
    setDiagnosing(true);
    startTransition(async () => {
      const result = await diagnoseConnectionAction(websiteId);
      setDiagnosing(false);
      if (result.success && result.diagnostics) {
        setDiagnostics(result.diagnostics);
      } else {
        setTestResult({ type: "error", message: result.error || "Diagnostics failed" });
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testExistingConnection(websiteId);
      if (result.success) {
        setTestResult({ type: "success", message: `Connected as: ${result.userName}` });
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

  function handleRevealPassword() {
    if (revealedPassword) {
      setRevealedPassword(null);
      return;
    }
    setRevealLoading(true);
    startTransition(async () => {
      const result = await revealAppPassword(websiteId);
      setRevealLoading(false);
      if (result.success && result.appPassword) {
        setRevealedPassword(result.appPassword);
      } else {
        setTestResult({ type: "error", message: result.error || "Failed to reveal password" });
      }
    });
  }

  function handleCopyPassword() {
    if (revealedPassword) {
      navigator.clipboard.writeText(revealedPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
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
            <span className="text-muted-foreground">Username</span>
            <span>{username}</span>
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">App Password</span>
            <span className="flex items-center gap-1.5">
              {revealedPassword ? (
                <>
                  <code className="max-w-[200px] truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                    {revealedPassword}
                  </code>
                  <button
                    onClick={handleCopyPassword}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedPassword ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => setRevealedPassword(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Hide
                  </button>
                </>
              ) : (
                <button
                  onClick={handleRevealPassword}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {revealLoading ? "Revealing..." : "Reveal"}
                </button>
              )}
            </span>
          </div>
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
          testResult.type === "success" ? (
            <p className="text-sm text-green-600">{testResult.message}</p>
          ) : (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
              <p className="whitespace-pre-line text-sm text-destructive">{testResult.message}</p>
            </div>
          )
        )}

        {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} />}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending}
          >
            {isPending && !disconnecting && !deploying && !diagnosing ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiagnose}
            disabled={isPending}
          >
            {diagnosing ? "Diagnosing..." : "Diagnose"}
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

// ─── Diagnostics Panel ───────────────────────────────────────────────

function DiagnosticsPanel({ diagnostics }: { diagnostics: ConnectionDiagnostics }) {
  const stepLabels: Record<string, string> = {
    site_reachable: "Site Reachable",
    rest_api_available: "REST API",
    authentication: "Authentication",
    admin_role: "Admin Role",
    mu_plugin: "mu-plugin",
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Connection Diagnostics
          {diagnostics.overall === "pass" && (
            <span className="ml-2 text-green-600">All checks passed</span>
          )}
          {diagnostics.overall === "fail" && (
            <span className="ml-2 text-destructive">Issues found</span>
          )}
          {diagnostics.overall === "warn" && (
            <span className="ml-2 text-amber-600">Warnings</span>
          )}
        </p>
        <span className="text-xs text-muted-foreground">{diagnostics.duration_ms}ms</span>
      </div>

      <div className="space-y-1.5">
        {diagnostics.steps.map((step, i) => (
          <DiagnosticStepRow key={i} step={step} label={stepLabels[step.step] || step.step} />
        ))}
      </div>
    </div>
  );
}

function DiagnosticStepRow({ step, label }: { step: DiagnosticStep; label: string }) {
  const [expanded, setExpanded] = useState(step.status !== "pass");

  const icon =
    step.status === "pass"
      ? "text-green-600"
      : step.status === "fail"
        ? "text-destructive"
        : "text-amber-600";

  const statusIcon =
    step.status === "pass" ? "\u2713" : step.status === "fail" ? "\u2717" : "!";

  return (
    <div className="rounded border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
      >
        <span className={`font-mono text-xs font-bold ${icon}`}>{statusIcon}</span>
        <span className="font-medium">{label}</span>
        <span className="flex-1 truncate text-muted-foreground">{step.message}</span>
        {step.detail && (
          <svg
            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </button>
      {expanded && step.detail && (
        <div className="border-t border-border px-3 py-2">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{step.detail}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Generate a random password in WordPress Application Password format (xxxx xxxx xxxx xxxx xxxx xxxx). */
function generateAppPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const groups: string[] = [];
  for (let g = 0; g < 6; g++) {
    let chunk = "";
    for (let i = 0; i < 4; i++) {
      const arr = new Uint8Array(1);
      crypto.getRandomValues(arr);
      chunk += chars[arr[0]! % chars.length];
    }
    groups.push(chunk);
  }
  return groups.join(" ");
}

// ─── Connect Form ────────────────────────────────────────────────────

interface ConnectFormProps {
  websiteId: string;
  siteUrl: string;
}

function ConnectForm({ websiteId, siteUrl }: ConnectFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(siteUrl.replace(/\/+$/, ""));
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  const [sshHost, setSshHost] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [showSsh, setShowSsh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Success state — show shared secret once
  const [connectResult, setConnectResult] = useState<{
    shared_secret: string;
    mu_plugin_installed: boolean;
    wp_user?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await connectWordPress({
        website_id: websiteId,
        site_url: url,
        username,
        app_password: appPassword,
        ssh_host: sshHost || undefined,
        ssh_user: sshUser || undefined,
        ssh_port: sshPort ? parseInt(sshPort, 10) : undefined,
      });

      if (result.success) {
        setConnectResult({
          shared_secret: result.shared_secret!,
          mu_plugin_installed: result.mu_plugin_installed!,
          wp_user: result.wp_user,
        });
      } else {
        setError(result.error || "Failed to connect");
      }
    });
  }

  function handleCopySecret() {
    if (connectResult) {
      navigator.clipboard.writeText(connectResult.shared_secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // After successful connection — show shared secret
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
            Connected as <strong>{connectResult.wp_user || username}</strong>.
          </p>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
            <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">
              Save this shared secret — it will not be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white p-2 text-xs dark:bg-black">
                {connectResult.shared_secret}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopySecret}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              Add to <code>wp-config.php</code>:
            </p>
            <code className="mt-1 block rounded bg-white p-2 text-xs dark:bg-black">
              {`define('DASHBOARD_SHARED_SECRET', '${connectResult.shared_secret}');`}
            </code>
          </div>

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
                The mu-plugin is required for debug logs, site health, and advanced features.
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
            Requires Application Password
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Pre-flight: Install mu-plugin first notice */}
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="mb-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
            Before connecting: install the mu-plugin on WordPress
          </p>
          <p className="mb-2 text-xs text-amber-800 dark:text-amber-300">
            Most hosting providers (Apache, LiteSpeed) strip auth headers, which prevents the connection from working.
            Installing the mu-plugin first solves this automatically.
          </p>
          <ol className="mb-2 list-inside list-decimal space-y-1 text-xs text-amber-800 dark:text-amber-300">
            <li>Download the plugin file below</li>
            <li>Upload it to <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">wp-content/mu-plugins/dashboard-connector.php</code></li>
            <li>Create the <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">mu-plugins</code> folder if it doesn&apos;t exist</li>
            <li>Then fill in the form below and click Connect &amp; Save</li>
          </ol>
          <a
            href="/mu-plugins/dashboard-connector.php"
            download="dashboard-connector.php"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download dashboard-connector.php
          </a>
        </div>

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
            <Label htmlFor="wp_user">WordPress Username</Label>
            <Input
              id="wp_user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="wp_pass">Application Password</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pw = generateAppPassword();
                    setAppPassword(pw);
                    setShowPassword(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Generate
                </button>
                {appPassword && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(appPassword);
                        setCopiedGenerated(true);
                        setTimeout(() => setCopiedGenerated(false), 2000);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedGenerated ? "Copied!" : "Copy"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <Input
              id="wp_pass"
              type={showPassword ? "text" : "password"}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              required
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            />
            <p className="text-xs text-muted-foreground">
              Generate a password here, copy it, then paste it in WordPress Admin &rarr; Users &rarr; Profile &rarr; Application Passwords.
            </p>
          </div>

          {/* SSH section (collapsible) */}
          <button
            type="button"
            onClick={() => setShowSsh(!showSsh)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showSsh ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            SSH for Auto-Deploy (optional)
          </button>

          {showSsh && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-2">
                <Label htmlFor="ssh_host">SSH Host</Label>
                <Input
                  id="ssh_host"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="server.example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ssh_user">SSH User</Label>
                  <Input
                    id="ssh_user"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh_port">SSH Port</Label>
                  <Input
                    id="ssh_port"
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    placeholder="22"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Connection Failed</p>
              <pre className="whitespace-pre-wrap text-xs text-destructive/90">{error}</pre>
              {error.includes("header") && error.includes("stripped") && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Quick fix: Download and install the mu-plugin first, then try again.
                  </p>
                  <a
                    href="/mu-plugins/dashboard-connector.php"
                    download="dashboard-connector.php"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-300"
                  >
                    Download dashboard-connector.php
                  </a>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || !url || !username || !appPassword}
          >
            {isPending ? "Connecting..." : "Connect & Save"}
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
        username={status.username || ""}
        muPluginInstalled={status.mu_plugin_installed || false}
        muPluginVersion={status.mu_plugin_version}
        lastHealthCheck={status.last_health_check}
        connectedAt={status.connected_at}
      />
    );
  }

  return <ConnectForm websiteId={websiteId} siteUrl={siteUrl} />;
}
