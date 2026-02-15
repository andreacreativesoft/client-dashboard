"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { sendEmailToClientAction } from "@/lib/actions/email";

interface ContactInfoProps {
  clientId: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

export function ContactInfo({ clientId, contactEmail, contactPhone }: ContactInfoProps) {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");

    const form = e.currentTarget;
    const subject = (form.elements.namedItem("subject") as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;

    const result = await sendEmailToClientAction(clientId, contactEmail!, subject, message);

    setSending(false);

    if (result.success) {
      setSent(true);
      setTimeout(() => {
        setEmailModalOpen(false);
        setSent(false);
      }, 1500);
    } else {
      setError(result.error || "Failed to send email");
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Contact Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactEmail ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Email
              </p>
              <button
                onClick={() => setEmailModalOpen(true)}
                className="text-sm hover:underline text-left"
              >
                {contactEmail}
              </button>
            </div>
          ) : null}
          {contactPhone ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Phone
              </p>
              <a
                href={`tel:${contactPhone}`}
                className="text-sm hover:underline"
              >
                {contactPhone}
              </a>
            </div>
          ) : null}
          {!contactEmail && !contactPhone && (
            <p className="text-sm text-muted-foreground">
              No contact info added
            </p>
          )}
        </CardContent>
      </Card>

      {contactEmail && (
        <Modal
          open={emailModalOpen}
          onClose={() => { setEmailModalOpen(false); setError(""); setSent(false); }}
          title="Send Email"
        >
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm font-medium">Email sent!</p>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <p className="text-sm font-medium">{contactEmail}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  placeholder="Email subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  placeholder="Write your message..."
                  className="min-h-[150px]"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEmailModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
