"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { updateLeadStatusAction } from "@/lib/actions/leads";
import { timeAgo } from "@/lib/utils";
import type { LeadStatus } from "@/types/database";

interface RecentLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  created_at: string;
  website_name: string;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string; activeColor: string }[] = [
  { value: "new", label: "New", color: "border-red-300 text-red-600 hover:bg-red-50", activeColor: "bg-red-500 text-white border-red-500" },
  { value: "contacted", label: "Contacted", color: "border-blue-300 text-blue-600 hover:bg-blue-50", activeColor: "bg-blue-500 text-white border-blue-500" },
  { value: "done", label: "Done", color: "border-green-300 text-green-600 hover:bg-green-50", activeColor: "bg-green-500 text-white border-green-500" },
];

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    setUpdating(leadId);
    await updateLeadStatusAction(leadId, newStatus);
    setUpdating(null);
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No leads yet. Leads will appear here when they come in via webhooks.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <div
          key={lead.id}
          className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            href={`/leads/${lead.id}`}
            className="min-w-0 flex-1 hover:opacity-80"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {lead.name || lead.email || lead.phone || "Unknown"}
              </span>
              <Badge
                variant={
                  lead.status === "new"
                    ? "default"
                    : lead.status === "contacted"
                    ? "warning"
                    : "success"
                }
              >
                {lead.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {lead.website_name} &bull; {timeAgo(lead.created_at)}
            </p>
          </Link>
          <div className="flex gap-2 sm:gap-0">
            <div className="flex flex-1 overflow-hidden rounded-lg border border-border" role="group" aria-label="Lead status">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(lead.id, status.value)}
                  disabled={updating === lead.id}
                  aria-pressed={lead.status === status.value}
                  aria-label={`Mark as ${status.label}`}
                  className={`flex-1 cursor-pointer px-3 py-2 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5 sm:py-1.5 sm:text-xs ${
                    lead.status === status.value
                      ? status.activeColor
                      : status.color + " bg-background"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <Link
              href={`/leads/${lead.id}`}
              className="inline-flex h-auto items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted sm:px-2.5 sm:text-xs"
            >
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
