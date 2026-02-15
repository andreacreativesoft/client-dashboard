"use client";

import { useState } from "react";
import { updateLeadStatusAction } from "@/lib/actions/leads";
import type { LeadStatus } from "@/types/database";

interface LeadStatusProps {
  leadId: string;
  currentStatus: LeadStatus;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string; activeColor: string }[] = [
  { value: "new", label: "New", color: "border-red-300 text-red-600 hover:bg-red-50", activeColor: "bg-red-500 text-white border-red-500" },
  { value: "contacted", label: "Contacted", color: "border-blue-300 text-blue-600 hover:bg-blue-50", activeColor: "bg-blue-500 text-white border-blue-500" },
  { value: "done", label: "Done", color: "border-green-300 text-green-600 hover:bg-green-50", activeColor: "bg-green-500 text-white border-green-500" },
];

export function LeadStatusToggle({ leadId, currentStatus }: LeadStatusProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: LeadStatus) {
    if (newStatus === status) return;

    setLoading(true);
    const result = await updateLeadStatusAction(leadId, newStatus);
    setLoading(false);

    if (result.success) {
      setStatus(newStatus);
    } else {
      alert(result.error || "Failed to update status");
    }
  }

  return (
    <div className="flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Lead status">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => handleChange(option.value)}
          disabled={loading}
          aria-pressed={status === option.value}
          aria-label={`Mark as ${option.label}`}
          className={`cursor-pointer px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            status === option.value
              ? option.activeColor
              : option.color + " bg-background"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
