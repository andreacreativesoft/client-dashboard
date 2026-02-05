"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ReportDownloadButtonProps {
  reportId: string;
}

export function ReportDownloadButton({ reportId }: ReportDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);

    try {
      const response = await fetch(`/api/reports/${reportId}`);
      const data = await response.json();

      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      } else {
        console.error("Failed to get download URL:", data.error);
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleDownload} disabled={loading} className="w-full">
      {loading ? (
        "Preparing..."
      ) : (
        <>
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Download PDF
        </>
      )}
    </Button>
  );
}
