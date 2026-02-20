"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTicketStatusAction } from "@/lib/actions/tickets";
import type { TicketStatus } from "@/types/database";

interface TicketStatusControlProps {
  ticketId: string;
  currentStatus: TicketStatus;
}

const STATUS_OPTIONS: { value: TicketStatus; label: string; color: string; activeColor: string }[] = [
  { value: "open", label: "Open", color: "border-red-300 text-red-600 hover:bg-red-50", activeColor: "bg-red-500 text-white border-red-500" },
  { value: "in_progress", label: "In Progress", color: "border-blue-300 text-blue-600 hover:bg-blue-50", activeColor: "bg-blue-500 text-white border-blue-500" },
  { value: "waiting_on_client", label: "Waiting", color: "border-yellow-300 text-yellow-600 hover:bg-yellow-50", activeColor: "bg-yellow-500 text-white border-yellow-500" },
  { value: "closed", label: "Closed", color: "border-green-300 text-green-600 hover:bg-green-50", activeColor: "bg-green-500 text-white border-green-500" },
];

export function TicketStatusControl({ ticketId, currentStatus }: TicketStatusControlProps) {
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  async function handleStatusChange(newStatus: TicketStatus) {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    await updateTicketStatusAction(ticketId, newStatus);
    router.refresh();
    setUpdating(false);
  }

  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {STATUS_OPTIONS.map((status) => (
        <button
          key={status.value}
          onClick={() => handleStatusChange(status.value)}
          disabled={updating}
          aria-pressed={currentStatus === status.value}
          aria-label={`Set status to ${status.label}`}
          className={`cursor-pointer px-4 py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:py-1.5 sm:text-xs ${
            currentStatus === status.value
              ? status.activeColor
              : status.color + " bg-background"
          }`}
        >
          {status.label}
        </button>
      ))}
    </div>
  );
}
