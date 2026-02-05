"use client";

import { Badge } from "@/components/ui/badge";

interface IntegrationCardProps {
  integration: {
    id: string;
    account_id: string;
    account_name: string | null;
    is_active: boolean;
    metadata: Record<string, unknown> | null;
  };
  clientName: string;
}

export function IntegrationCard({ integration, clientName }: IntegrationCardProps) {
  const needsSelection =
    integration.metadata?.needsPropertySelection ||
    integration.metadata?.needsLocationSelection;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{clientName}</p>
        <p className="text-xs text-muted-foreground">
          {needsSelection
            ? "Select property/location to complete setup"
            : integration.account_name || integration.account_id}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {needsSelection ? (
          <Badge variant="secondary">Setup Required</Badge>
        ) : integration.is_active ? (
          <Badge variant="default">Connected</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </div>
    </div>
  );
}
