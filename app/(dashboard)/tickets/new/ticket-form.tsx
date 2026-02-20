"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TicketPriority, TicketCategory } from "@/types/database";

interface TicketFormProps {
  clients: { id: string; business_name: string }[];
  adminUsers: { id: string; full_name: string }[];
  isAdmin: boolean;
  defaultClientId?: string;
}

export function TicketForm({ clients, adminUsers, isAdmin, defaultClientId }: TicketFormProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const [clientId, setClientId] = useState(defaultClientId || (!isAdmin && clients[0] ? clients[0].id : ""));
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [category, setCategory] = useState<TicketCategory>("support");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !subject.trim() || !description.trim()) return;

    setSubmitting(true);
    setError(null);

    const result = await createTicketAction({
      client_id: clientId,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      category,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
    });

    if (result.success && result.ticketId) {
      router.push(`/tickets/${result.ticketId}`);
    } else {
      setError(result.error || "Failed to create ticket");
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client — only admins see the selector */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="client">{t("tickets.client")}</Label>
              {clients.length === 1 ? (
                <p className="text-sm font-medium">{clients[0]!.business_name}</p>
              ) : (
                <select
                  id="client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t("tickets.select_client")}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.business_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">{t("tickets.subject")}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("tickets.subject_placeholder")}
              required
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("tickets.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tickets.description_placeholder")}
              required
              rows={6}
              maxLength={10000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">{t("tickets.category")}</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="support">{t("tickets.cat_support")}</option>
                <option value="bug">{t("tickets.cat_bug")}</option>
                <option value="feature_request">{t("tickets.cat_feature")}</option>
                <option value="billing">{t("tickets.cat_billing")}</option>
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">{t("tickets.priority")}</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="low">{t("tickets.priority_low")}</option>
                <option value="medium">{t("tickets.priority_medium")}</option>
                <option value="high">{t("tickets.priority_high")}</option>
                <option value="urgent">{t("tickets.priority_urgent")}</option>
              </select>
            </div>
          </div>

          {/* Admin-only fields */}
          {isAdmin && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Assigned To */}
              <div className="space-y-2">
                <Label htmlFor="assigned_to">{t("tickets.assigned_to")}</Label>
                <select
                  id="assigned_to"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t("tickets.unassigned")}</option>
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">{t("tickets.due_date")}</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || !clientId || !subject.trim() || !description.trim()}>
              {submitting ? t("tickets.creating") : t("tickets.create_ticket")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
