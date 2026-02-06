"use client";

import Link from "next/link";
import type { ClientAlert } from "@/lib/actions/alerts";

interface ClientAlertsProps {
  alerts: ClientAlert[];
}

const alertIcons: Record<string, React.ReactNode> = {
  inactive_user: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  uncontacted_leads: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  ),
  broken_integration: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
};

function getAlertLink(alert: ClientAlert): string | null {
  switch (alert.type) {
    case "inactive_user":
      return "/admin/users";
    case "uncontacted_leads":
      return alert.clientId ? `/leads?client=${alert.clientId}` : "/leads";
    case "broken_integration":
      return alert.clientId ? `/admin/clients/${alert.clientId}` : "/admin/clients";
    default:
      return null;
  }
}

export function ClientAlerts({ alerts }: ClientAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <div className="mb-2 flex justify-center">
          <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="text-sm font-medium">All Clear</p>
        <p className="text-xs text-muted-foreground">No alerts at this time</p>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-3 text-sm">
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <span className="h-2 w-2 rounded-full bg-warning" />
            {warningCount} warning
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert) => {
          const link = getAlertLink(alert);
          const content = (
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                alert.severity === "critical"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-warning/30 bg-warning/5"
              } ${link ? "cursor-pointer hover:bg-muted/50" : ""}`}
            >
              <div
                className={`mt-0.5 ${
                  alert.severity === "critical" ? "text-destructive" : "text-warning"
                }`}
              >
                {alertIcons[alert.type]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
              </div>
            </div>
          );

          return link ? (
            <Link key={alert.id} href={link}>
              {content}
            </Link>
          ) : (
            <div key={alert.id}>{content}</div>
          );
        })}
      </div>

      {alerts.length > 5 && (
        <p className="text-center text-xs text-muted-foreground">
          +{alerts.length - 5} more alerts
        </p>
      )}
    </div>
  );
}
