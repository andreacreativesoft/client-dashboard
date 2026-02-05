"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stopImpersonation } from "@/lib/actions/impersonate";

interface ImpersonateBannerProps {
  clientName: string;
}

export function ImpersonateBanner({ clientName }: ImpersonateBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExit() {
    setLoading(true);
    await stopImpersonation();
    router.refresh();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-warning px-4 py-2 text-warning-foreground">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
        </svg>
        <span className="text-sm font-medium">
          Viewing as: <strong>{clientName}</strong>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={loading}
        className="rounded bg-warning-foreground/20 px-3 py-1 text-sm font-medium hover:bg-warning-foreground/30 disabled:opacity-50"
      >
        {loading ? "Exiting..." : "Exit View"}
      </button>
    </div>
  );
}
