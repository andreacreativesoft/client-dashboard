"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateLeadStatusAction } from "@/lib/actions/leads";
import type { LeadStatus } from "@/types/database";

interface LeadStatusProps {
  leadId: string;
  currentStatus: LeadStatus;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "done", label: "Done" },
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
    <div className="flex gap-2">
      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={status === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => handleChange(option.value)}
          disabled={loading}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
