import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTicket, getTicketReplies } from "@/lib/actions/tickets";
import { getProfile } from "@/lib/actions/profile";
import { formatDate, timeAgo } from "@/lib/utils";
import { TicketReplies } from "./ticket-replies";
import { TicketStatusControl } from "./ticket-status-control";

export const metadata: Metadata = {
  title: "Ticket Detail",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500 text-white",
  in_progress: "bg-blue-500 text-white",
  waiting_on_client: "bg-yellow-500 text-white",
  closed: "bg-green-500 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_client: "Waiting on Client",
  closed: "Closed",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature_request: "Feature Request",
  support: "Support",
  billing: "Billing",
};

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [ticket, replies, profile] = await Promise.all([
    getTicket(id),
    getTicketReplies(id),
    getProfile(),
  ]);

  if (!ticket) {
    notFound();
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link
          href="/tickets"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Tickets
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{ticket.subject}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ticket.status] || "bg-muted text-muted-foreground"}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>
              {ticket.priority}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {timeAgo(ticket.created_at)} by {ticket.created_by_name}
          </p>
        </div>
        {isAdmin && (
          <TicketStatusControl ticketId={ticket.id} currentStatus={ticket.status} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Replies */}
          <TicketReplies
            ticketId={ticket.id}
            replies={replies}
            isAdmin={isAdmin}
            isClosed={ticket.status === "closed"}
          />
        </div>

        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Client</p>
                <p className="text-sm">{ticket.client_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Category</p>
                <p className="text-sm">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Priority</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                  {ticket.priority}
                </span>
              </div>
              {ticket.assigned_to_name && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Assigned To</p>
                  <p className="text-sm">{ticket.assigned_to_name}</p>
                </div>
              )}
              {ticket.due_date && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Due Date</p>
                  <p className="text-sm">{formatDate(ticket.due_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(ticket.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDate(ticket.updated_at)}</p>
              </div>
              {ticket.closed_at && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Closed</p>
                  <p className="text-sm">{formatDate(ticket.closed_at)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Replies</p>
                <p className="text-sm">{ticket.reply_count}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
