"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { connectWordPress } from "@/lib/actions/wordpress-manage";

interface WPConnectFormProps {
  websiteId: string;
  siteUrl: string;
  onDone: () => void;
}

export function WPConnectForm({ websiteId, siteUrl, onDone }: WPConnectFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(siteUrl.replace(/\/+$/, ""));
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [showSsh, setShowSsh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
            Requires Application Password
          </Badge>
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

      {/* SSH section (collapsible) */}
      <button
        type="button"
        onClick={() => setShowSsh(!showSsh)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <svg
          className={`h-2.5 w-2.5 transition-transform ${showSsh ? "rotate-90" : ""}`}
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
        <div className="space-y-2 rounded border border-border p-2">
          <div className="space-y-1">
            <Label htmlFor="ssh_host" className="text-xs">SSH Host</Label>
            <Input
              id="ssh_host"
              value={sshHost}
              onChange={(e) => setSshHost(e.target.value)}
              placeholder="server.example.com"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ssh_user" className="text-xs">SSH User</Label>
              <Input
                id="ssh_user"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                placeholder="root"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ssh_port" className="text-xs">SSH Port</Label>
              <Input
                id="ssh_port"
                type="number"
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
                placeholder="22"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !url || !username || !appPassword}
          className="h-7 text-xs"
        >
          {isPending ? "Connecting..." : "Connect & Save"}
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
