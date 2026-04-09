"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTicketAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TicketPriority, TicketCategory } from "@/types/database";

interface TicketFormProps {
  clients: { id: string; business_name: string }[];
  adminUsers: { id: string; full_name: string }[];
  isAdmin: boolean;
  defaultClientId?: string;
}

const inputClass =
  "w-full rounded-lg border border-[#B5C3BE] bg-[#F9FAFB] px-4 py-3 text-[14px] leading-[1.5] text-[#2E2E2E] placeholder-[#6D6A65] outline-none transition-colors focus:border-[#2A5959]";

const selectClass =
  "w-full rounded-lg border border-[#B5C3BE] bg-[#F9FAFB] px-4 py-3 text-[14px] leading-[1.5] text-[#2E2E2E] outline-none transition-colors focus:border-[#2A5959]";

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
    <form onSubmit={handleSubmit} className="flex max-w-[640px] flex-col gap-6">
      <p className="text-[20px] font-bold leading-[1.5] text-[#2E2E2E]">
        Nouvelle demande
      </p>

      {/* Client — only admins see the selector */}
      {isAdmin && (
        <div className="flex flex-col gap-2">
          <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="client">
            {t("tickets.client")}
          </label>
          {clients.length === 1 ? (
            <p className="text-[14px] font-bold text-[#2E2E2E]">{clients[0]!.business_name}</p>
          ) : (
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className={selectClass}
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

      {/* Subject / Page concernée */}
      <div className="flex flex-col gap-2">
        <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="subject">
          Page concernée
        </label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex: Page d'accueil, Contact, etc."
          required
          maxLength={200}
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="description">
          Que souhaitez-vous que nous changions ?
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrivez en détail les modifications que vous souhaitez apporter à votre site web. Plus vous êtes précis, plus nous pourrons vous aider efficacement..."
          required
          rows={6}
          maxLength={10000}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-3">
        <select
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="w-full border-b-2 border-[#F1F1F1] bg-transparent py-3 text-[16px] leading-[1.5] text-[#2E2E2E] outline-none"
        >
          <option value="low">Faible</option>
          <option value="medium">Normale</option>
          <option value="high">Haute</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      {/* Admin-only fields */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="category">
              {t("tickets.category")}
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className={selectClass}
            >
              <option value="support">{t("tickets.cat_support")}</option>
              <option value="bug">{t("tickets.cat_bug")}</option>
              <option value="feature_request">{t("tickets.cat_feature")}</option>
              <option value="billing">{t("tickets.cat_billing")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="assigned_to">
              {t("tickets.assigned_to")}
            </label>
            <select
              id="assigned_to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("tickets.unassigned")}</option>
              {adminUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] leading-[1.5] text-[#2E2E2E]" htmlFor="due_date">
              {t("tickets.due_date")}
            </label>
            <input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-[14px] text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !clientId || !subject.trim() || !description.trim()}
        className="w-full cursor-pointer rounded-full bg-[#F2612E] px-5 py-3 text-[18px] font-bold uppercase leading-[1.5] tracking-[0.72px] text-white transition-colors hover:bg-[#E0551F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Envoi..." : "Submit"}
      </button>
    </form>
  );
}
