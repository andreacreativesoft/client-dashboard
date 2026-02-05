"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  updateLeadStatusAction,
  deleteLeadAction,
  type LeadWithDetails,
} from "@/lib/actions/leads";
import { timeAgo } from "@/lib/utils";
import type { LeadStatus } from "@/types/database";

interface LeadsListProps {
  leads: LeadWithDetails[];
  isAdmin: boolean;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; variant: "default" | "warning" | "success" }[] = [
  { value: "new", label: "New", variant: "default" },
  { value: "contacted", label: "Contacted", variant: "warning" },
  { value: "done", label: "Done", variant: "success" },
];

export function LeadsList({ leads, isAdmin }: LeadsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status !== statusFilter) {
      return false;
    }
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        lead.name?.toLowerCase().includes(searchLower) ||
        lead.email?.toLowerCase().includes(searchLower) ||
        lead.phone?.toLowerCase().includes(searchLower) ||
        lead.client_name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    setUpdating(leadId);
    await updateLeadStatusAction(leadId, newStatus);
    setUpdating(null);
  }

  async function handleDelete(lead: LeadWithDetails) {
    if (!confirm(`Delete this lead from ${lead.name || lead.email || "unknown"}?`)) {
      return;
    }
    setUpdating(lead.id);
    await deleteLeadAction(lead.id);
    setUpdating(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <span className="text-sm text-muted-foreground">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          {STATUS_OPTIONS.map((status) => (
            <Button
              key={status.value}
              variant={statusFilter === status.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status.value)}
            >
              {status.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Leads */}
      {filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {leads.length === 0
                ? "No leads yet. Leads will appear here when they come in via webhooks."
                : "No leads match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-semibold hover:underline"
                      >
                        {lead.name || lead.email || lead.phone || "Unknown"}
                      </Link>
                      <Badge variant={STATUS_OPTIONS.find((s) => s.value === lead.status)?.variant || "default"}>
                        {lead.status}
                      </Badge>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {lead.email && <span>{lead.email}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>

                    {lead.message && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {lead.message}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{timeAgo(lead.created_at)}</span>
                      <span>•</span>
                      <span>{lead.website_name}</span>
                      {isAdmin && (
                        <>
                          <span>•</span>
                          <span>{lead.client_name}</span>
                        </>
                      )}
                      {lead.form_name && (
                        <>
                          <span>•</span>
                          <span>Form: {lead.form_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                      disabled={updating === lead.id}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
