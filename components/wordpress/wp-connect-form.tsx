"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  addWordPressIntegration,
  testWordPressConnection,
} from "@/lib/actions/wordpress-remote";

/** Generate a random password in WordPress Application Password format. */
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

interface WPConnectFormProps {
  clientId: string;
  siteUrl: string;
  onDone: () => void;
}

export function WPConnectForm({ clientId, siteUrl, onDone }: WPConnectFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(siteUrl.replace(/\/+$/, ""));
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);

  function handleTest() {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    startTransition(async () => {
      const result = await testWordPressConnection(url, username, appPassword);
      setIsTesting(false);

      if (result.success) {
        setTestResult(`Connected as: ${result.userName}`);
      } else {
        setError(result.error || "Connection failed");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await addWordPressIntegration(
        clientId,
        url,
        username,
        appPassword
      );

      if (result.success) {
        onDone();
        router.refresh();
      } else {
        setError(result.error || "Failed to save integration");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded border border-border p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Connect WordPress</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Requires mu-plugin
          </Badge>
          <a
            href="/mu-plugins/dashboard-connector.php"
            download="dashboard-connector.php"
            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </a>
        </div>
      </div>

      {/* Pre-flight: install mu-plugin before connecting */}
      <div className="rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950">
        <p className="mb-1 text-[10px] font-medium text-amber-900 dark:text-amber-200">
          Step 1 — Install the mu-plugin on the WordPress site first
        </p>
        <p className="text-[10px] text-amber-800 dark:text-amber-300">
          Most hosting (Apache, LiteSpeed) strips auth headers, which blocks the connection.
          Upload <code className="rounded bg-amber-100 px-0.5 dark:bg-amber-900">dashboard-connector.php</code> to <code className="rounded bg-amber-100 px-0.5 dark:bg-amber-900">wp-content/mu-plugins/</code> first,
          then fill in the form below.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="wp_url" className="text-xs">
          Site URL
        </Label>
        <Input
          id="wp_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://example.com"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="wp_username" className="text-xs">
          WordPress Username
        </Label>
        <Input
          id="wp_username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="admin"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="wp_app_password" className="text-xs">
            Application Password
          </Label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const pw = generateAppPassword();
                setAppPassword(pw);
                setShowPassword(true);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Generate
            </button>
            {appPassword && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
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
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {copiedGenerated ? "Copied!" : "Copy"}
                </button>
              </>
            )}
          </div>
        </div>
        <Input
          id="wp_app_password"
          type={showPassword ? "text" : "password"}
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          required
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Generate a password here, copy it, then paste it in WordPress Admin &rarr; Users &rarr; Profile &rarr; Application Passwords.
        </p>
      </div>

      {testResult && (
        <p className="text-xs text-green-600">{testResult}</p>
      )}
      {error && (
        <div className="space-y-2 rounded border border-destructive/30 bg-destructive/5 p-2">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-destructive">{error}</pre>
          {error.includes("header stripped") && (
            <div className="rounded border border-amber-300 bg-amber-50 p-1.5 dark:border-amber-700 dark:bg-amber-950">
              <a
                href="/mu-plugins/dashboard-connector.php"
                download="dashboard-connector.php"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-300"
              >
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download dashboard-connector.php — upload to wp-content/mu-plugins/ and retry
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={isPending || !url || !username || !appPassword}
          className="h-7 text-xs"
        >
          {isTesting ? "Testing..." : "Test Connection"}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !url || !username || !appPassword}
          className="h-7 text-xs"
        >
          {isPending && !isTesting ? "Saving..." : "Connect & Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
