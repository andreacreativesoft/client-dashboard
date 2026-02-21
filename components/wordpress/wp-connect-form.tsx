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
        <Label htmlFor="wp_app_password" className="text-xs">
          Application Password
        </Label>
        <Input
          id="wp_app_password"
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          required
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          WordPress Admin &rarr; Users &rarr; Profile &rarr; Application Passwords
        </p>
      </div>

      {testResult && (
        <p className="text-xs text-green-600">{testResult}</p>
      )}
      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2">
          <p className="whitespace-pre-line text-xs text-destructive">{error}</p>
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
