"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { addSubmissionNoteAction, type SubmissionNoteWithUser } from "@/lib/actions/submissions";
import { useLanguage } from "@/lib/i18n/language-context";
import { timeAgo } from "@/lib/utils";

interface SubmissionNotesProps {
    submissionId: string;
    notes: SubmissionNoteWithUser[];
}

export function SubmissionNotes({ submissionId, notes }: SubmissionNotesProps) {
    const { t } = useLanguage();
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!content.trim()) return;

        setLoading(true);
        const result = await addSubmissionNoteAction(submissionId, content.trim());
        setLoading(false);

        if (result.success) {
            setContent("");
        } else {
            toast.error(result.error || t("submissions.note_add_failed"));
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("submissions.notes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Textarea
                        placeholder={t("submissions.add_note_placeholder")}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={3}
                    />
                    <Button type="submit" size="sm" disabled={loading || !content.trim()}>
                        {loading ? t("submissions.adding") : t("submissions.add_note")}
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
                    <p className="text-sm text-muted-foreground">{t("submissions.no_notes")}</p>
                )}
            </CardContent>
        </Card>
    );
}
