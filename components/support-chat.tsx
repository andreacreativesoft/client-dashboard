"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  getOrCreateChatTicket,
  getChatMessages,
  addTicketReplyAction,
  createTicketAction,
} from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_role: "admin" | "client";
  user_avatar: string | null;
};

interface SupportChatProps {
  userId: string;
  userRole: "admin" | "client";
  clientId: string | null;
  openTicketCount: number;
}

export function SupportChat({
  userId,
  userRole,
  clientId,
  openTicketCount,
}: SupportChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [adminCount, setAdminCount] = useState(0);

  // Ticket form state (offline mode)
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track admin presence via Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("admin-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        let count = 0;
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (entries?.some((e: Record<string, unknown>) => e.role === "admin")) {
            count++;
          }
        }
        setAdminCount(count);
        setAdminOnline(count > 0);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ role: userRole, user_id: userId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole]);

  // Subscribe to real-time replies when ticket is active
  useEffect(() => {
    if (!ticketId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-replies-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_replies",
          filter: `ticket_id=eq.${ticketId}`,
        },
        async () => {
          const updated = await getChatMessages(ticketId);
          setMessages(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Open chat panel — if admin is online, load live chat
  const openChat = useCallback(async () => {
    setIsOpen(true);
    setTicketSubmitted(false);
    setTicketError(null);

    if (userRole === "admin") return;
    if (!clientId) return;

    // Only load chat history if admin is online (chat mode)
    if (adminOnline) {
      setLoading(true);
      const result = await getOrCreateChatTicket(clientId);
      if (result) {
        setTicketId(result.ticketId);
        const msgs = await getChatMessages(result.ticketId);
        setMessages(msgs);
      }
      setLoading(false);
    }
  }, [clientId, userRole, adminOnline]);

  // Switch to chat mode when admin comes online while panel is open
  useEffect(() => {
    if (isOpen && adminOnline && !ticketId && clientId && userRole !== "admin") {
      (async () => {
        setLoading(true);
        const result = await getOrCreateChatTicket(clientId);
        if (result) {
          setTicketId(result.ticketId);
          const msgs = await getChatMessages(result.ticketId);
          setMessages(msgs);
        }
        setLoading(false);
      })();
    }
  }, [isOpen, adminOnline, ticketId, clientId, userRole]);

  const sendMessage = async () => {
    if (!input.trim() || !ticketId || sending) return;

    setSending(true);
    const result = await addTicketReplyAction(ticketId, input.trim(), false);
    if (result.success) {
      setInput("");
    }
    setSending(false);
  };

  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim() || !clientId || sending) return;

    setSending(true);
    setTicketError(null);

    const result = await createTicketAction({
      client_id: clientId,
      subject: ticketSubject.trim(),
      description: ticketDescription.trim(),
      category: "support",
      priority: "medium",
    });

    if (result.success) {
      setTicketSubmitted(true);
      setTicketSubject("");
      setTicketDescription("");
    } else {
      setTicketError(result.error || "Failed to create ticket");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ─── Admin view: badge + link to tickets ──────────────────────────
  if (userRole === "admin") {
    return (
      <a
        href="/tickets?status=open"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6"
        title={`${openTicketCount} open ticket${openTicketCount !== 1 ? "s" : ""}`}
      >
        <ChatIcon />
        {openTicketCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {openTicketCount > 99 ? "99+" : openTicketCount}
          </span>
        )}
      </a>
    );
  }

  // ─── Client view: chat widget ──────────────────────────────────────
  return (
    <>
      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={openChat}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6"
          title="Support"
        >
          <ChatIcon />
          {/* Online dot */}
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
              adminOnline ? "bg-green-500" : "bg-gray-400"
            )}
          />
          {openTicketCount > 0 && (
            <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
              {openTicketCount > 99 ? "99+" : openTicketCount}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[100dvh] w-full flex-col border-l border-border bg-background shadow-2xl md:bottom-6 md:right-6 md:h-[520px] md:w-[380px] md:rounded-2xl md:border">
          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  S
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                    adminOnline ? "bg-green-500" : "bg-gray-400"
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-semibold">Support</p>
                <p className="text-xs text-muted-foreground">
                  {adminOnline
                    ? `Online${adminCount > 1 ? ` (${adminCount})` : ""}`
                    : "Offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/tickets"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                title="View all tickets"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : !clientId ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No client account linked. Please contact your administrator.
                </p>
              </div>
            ) : adminOnline ? (
              /* ─── CHAT MODE (admin online) ─── */
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <EmptyChatIcon />
                      <p className="text-sm font-medium">Start a conversation</p>
                      <p className="text-xs text-muted-foreground">
                        An admin is available to help you now.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isOwn={msg.user_id === userId}
                          formatTime={formatTime}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ─── TICKET MODE (admin offline) ─── */
              <div className="flex h-full flex-col items-center justify-center px-6 py-6">
                {ticketSubmitted ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">Ticket submitted!</p>
                    <p className="text-xs text-muted-foreground">
                      {"We'll get back to you as soon as possible."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTicketSubmitted(false)}
                      className="mt-2"
                    >
                      Send another
                    </Button>
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">{"We're currently offline"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Leave us a message and {"we'll"} get back to you.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="What do you need help with?"
                        maxLength={200}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Message
                      </label>
                      <textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="Describe your issue..."
                        rows={4}
                        maxLength={10000}
                        className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>

                    {ticketError && (
                      <p className="text-xs text-red-600">{ticketError}</p>
                    )}

                    <Button
                      onClick={submitTicket}
                      disabled={!ticketSubject.trim() || !ticketDescription.trim() || sending}
                      className="w-full"
                    >
                      {sending ? "Submitting..." : "Submit Ticket"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Chat input (only in chat mode when admin is online) ── */}
          {clientId && adminOnline && !loading && (
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="max-h-20 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  size="sm"
                  className="h-10 w-10 rounded-xl p-0"
                >
                  {sending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function EmptyChatIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
      <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    </div>
  );
}

function MessageBubble({
  msg,
  isOwn,
  formatTime,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  formatTime: (d: string) => string;
}) {
  return (
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <div className="flex-shrink-0">
          {msg.user_avatar ? (
            <Image
              src={msg.user_avatar}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {msg.user_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted"
        )}
      >
        {!isOwn && (
          <p className="mb-0.5 text-[10px] font-medium opacity-70">
            {msg.user_name}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
        <p
          className={cn(
            "mt-0.5 text-[10px]",
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}
