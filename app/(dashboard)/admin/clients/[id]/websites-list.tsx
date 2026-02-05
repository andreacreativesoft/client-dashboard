"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebsiteForm } from "./website-form";
import { deleteWebsiteAction, regenerateApiKeyAction } from "@/lib/actions/websites";
import type { Website } from "@/types/database";

interface WebsitesListProps {
  clientId: string;
  websites: Website[];
}

export function WebsitesList({ clientId, websites }: WebsitesListProps) {
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
