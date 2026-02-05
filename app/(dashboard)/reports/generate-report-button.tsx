"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { format, subMonths } from "date-fns";

interface Client {
  id: string;
  business_name: string;
}

interface GenerateReportButtonProps {
  clients: Client[];
}

export function GenerateReportButton({ clients }: GenerateReportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Default to last month
  const lastMonth = subMonths(new Date(), 1);
  const defaultPeriod = format(lastMonth, "yyyy-MM");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const clientId = (form.elements.namedItem("client_id") as HTMLSelectElement).value;
    const period = (form.elements.namedItem("period") as HTMLInputElement).value;
    const sendEmail = (form.elements.namedItem("send_email") as HTMLInputElement).checked;
    const generateAll = clientId === "all";

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: generateAll ? undefined : clientId,
          period,
          sendEmail,
          generateAll,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (generateAll) {
          setSuccess(`Generated ${data.generated} reports. ${data.failed} failed.`);
        } else {
          setSuccess("Report generated successfully!");
        }
        router.refresh();
      } else {
        setError(data.error || "Failed to generate report");
      }
    } catch (err) {
      setError("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
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
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        Generate Report
      </Button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Generate Report">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name="client_id"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a client</option>
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.business_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Report Period</Label>
            <input
              type="month"
              id="period"
              name="period"
              defaultValue={defaultPeriod}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="send_email"
              name="send_email"
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="send_email" className="text-sm font-normal">
              Send email notification to client users
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
