"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addLeadNoteAction, type LeadNoteWithUser } from "@/lib/actions/leads";
import { timeAgo } from "@/lib/utils";

interface LeadNotesProps {
  leadId: string;
  notes: LeadNoteWithUser[];
}

export function LeadNotes({ leadId, notes }: LeadNotesProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    const result = await addLeadNoteAction(leadId, content.trim());
    setLoading(false);

    if (result.success) {
      setContent("");
    } else {
      alert(result.error || "Failed to add note");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Add a note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <Button type="submit" size="sm" disabled={loading || !content.trim()}>
            {loading ? "Adding..." : "Add Note"}
          </Button>
        </form>

        {notes.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-muted p-3">
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {note.user_name} • {timeAgo(note.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
