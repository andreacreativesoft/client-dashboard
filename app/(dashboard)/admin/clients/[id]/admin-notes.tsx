"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClientNotesAction } from "@/lib/actions/clients";

interface AdminNotesProps {
  clientId: string;
  initialNotes: string | null;
}

export function AdminNotes({ clientId, initialNotes }: AdminNotesProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  async function handleSave() {
    setIsSaving(true);
    setError("");

    const result = await updateClientNotesAction(clientId, notes);

    setIsSaving(false);

    if (!result.success) {
      setError(result.error || "Failed to save notes");
      return;
    }

    setIsEditing(false);
  }

  function handleCancel() {
    setNotes(initialNotes || "");
    setIsEditing(false);
    setError("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Internal Admin Notes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Hidden from clients
          </p>
        </div>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            {notes ? "Edit" : "Add"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this client...

Examples:
• Client slow to respond
• Upsell SEO next month
• Prefers WhatsApp contact"
              className="min-h-[120px] text-sm"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No notes yet. Click &quot;Add&quot; to add internal notes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
