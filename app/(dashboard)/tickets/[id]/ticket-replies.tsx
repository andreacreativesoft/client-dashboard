"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { addTicketReplyAction } from "@/lib/actions/tickets";
import { timeAgo } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TicketReplyWithUser } from "@/types/database";

interface TicketRepliesProps {
  ticketId: string;
  replies: TicketReplyWithUser[];
  isAdmin: boolean;
  isClosed: boolean;
}

export function TicketReplies({ ticketId, replies, isAdmin, isClosed }: TicketRepliesProps) {
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useLanguage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);

    const result = await addTicketReplyAction(ticketId, content, isInternal);

    if (result.success) {
      setContent("");
      setIsInternal(false);
      router.refresh();
    } else {
      setError(result.error || "Failed to add reply");
    }

    setSubmitting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tickets.replies")} ({replies.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {replies.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("tickets.no_replies")}</p>
        )}

        {replies.map((reply) => (
          <div
            key={reply.id}
            className={`rounded-lg border p-4 ${
              reply.is_internal
                ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                : reply.user_role === "admin"
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                  : "border-border bg-background"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {reply.user_avatar ? (
                  <Image
                    src={reply.user_avatar}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {reply.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium">{reply.user_name}</span>
                {reply.user_role === "admin" && (
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Admin
                  </span>
                )}
                {reply.is_internal && (
                  <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
                    {t("tickets.internal_note")}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {timeAgo(reply.created_at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{reply.content}</p>
          </div>
        ))}

        {/* Reply form */}
        {!isClosed && (
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
            <Textarea
              placeholder={t("tickets.reply_placeholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              required
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    {t("tickets.internal_note")}
                  </label>
                )}
              </div>
              <Button type="submit" disabled={submitting || !content.trim()}>
                {submitting ? t("tickets.sending") : t("tickets.send_reply")}
              </Button>
            </div>
          </form>
        )}

        {isClosed && (
          <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
            {t("tickets.closed_message")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
