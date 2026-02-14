import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLead, getLeadNotes } from "@/lib/actions/leads";
import { LeadNotes } from "./lead-notes";
import { LeadStatusToggle } from "./lead-status";
import { formatDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lead Detail",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-red-500 text-white",
  contacted: "bg-blue-500 text-white",
  done: "bg-green-500 text-white",
};

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [lead, notes] = await Promise.all([getLead(id), getLeadNotes(id)]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link
          href="/leads"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Leads
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">
              {lead.name || lead.email || lead.phone || "Unknown Lead"}
            </h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] || "bg-muted text-muted-foreground"}`}>
              {lead.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Received {timeAgo(lead.created_at)} • {lead.website_name}
          </p>
        </div>
        <LeadStatusToggle leadId={lead.id} currentStatus={lead.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.name && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Name
                  </p>
                  <p className="text-base">{lead.name}</p>
                </div>
              )}
              {lead.email && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Email
                  </p>
                  <a href={`mailto:${lead.email}`} className="text-base break-all hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Phone
                  </p>
                  <a href={`tel:${lead.phone}`} className="text-base hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.message && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Message
                  </p>
                  <p className="text-base whitespace-pre-wrap">{lead.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Data */}
          {Object.keys(lead.raw_data).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>All Form Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-x-auto rounded-lg bg-muted p-4">
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(lead.raw_data, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <LeadNotes leadId={lead.id} notes={notes} />
        </div>

        <div className="space-y-6">
          {/* Source Info */}
          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Website
                </p>
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                >
                  {lead.website_name}
                </a>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Client
                </p>
                <p className="text-sm">{lead.client_name}</p>
              </div>
              {lead.form_name && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Form
                  </p>
                  <p className="text-sm">{lead.form_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Source Type
                </p>
                <p className="text-sm">{lead.source}</p>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Submitted
                </p>
                <p className="text-sm">{formatDate(lead.submitted_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Received
                </p>
                <p className="text-sm">{formatDate(lead.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
