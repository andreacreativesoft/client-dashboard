import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageTitle } from "@/components/ui/page";
import { getProfile } from "@/lib/actions/profile";
import { getSubmission, getSubmissionNotes } from "@/lib/actions/submissions";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { formatDate, timeAgo } from "@/lib/utils";
import { requireClientView } from "@/lib/view-context";
import type { SubmissionStatus } from "@/types/database";

import { SubmissionNotes } from "./submission-notes";
import { SubmissionStatusToggle } from "./submission-status";

export const metadata: Metadata = {
    title: "Contact",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<SubmissionStatus, string> = {
    new: "bg-orange text-white",
    contacted: "bg-green text-white",
    done: "bg-brand text-white",
};

const STATUS_LABEL: Record<SubmissionStatus, TranslationKey> = {
    new: "leads.new",
    contacted: "leads.contacted",
    done: "leads.done",
};

export default async function SubmissionDetailPage({ params }: PageProps) {
    await requireClientView();

    const { id } = await params;
    const [submission, notes, profile] = await Promise.all([
        getSubmission(id),
        getSubmissionNotes(id),
        getProfile(),
    ]);

    if (!submission) {
        notFound();
    }

    const lang = profile?.language || "fr-BE";

    return (
        <PageContainer>
            <div className="mb-6">
                <Link
                    href="/submissions"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
                    <ArrowLeft className="h-4 w-4" />
                    {t(lang, "submission.back")}
                </Link>
            </div>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <PageTitle>
                            {submission.name ||
                                submission.email ||
                                submission.phone ||
                                t(lang, "leads.unknown")}
                        </PageTitle>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[submission.status]}`}>
                            {t(lang, STATUS_LABEL[submission.status])}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t(lang, "submission.received")} {timeAgo(submission.created_at)}
                        {submission.website_name ? ` • ${submission.website_name}` : ""}
                    </p>
                </div>
                <SubmissionStatusToggle
                    submissionId={submission.id}
                    currentStatus={submission.status}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    {/* Contact Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "submission.contact_info")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {submission.name && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_name")}
                                    </p>
                                    <p className="text-base">{submission.name}</p>
                                </div>
                            )}
                            {submission.email && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_email")}
                                    </p>
                                    <a
                                        href={`mailto:${submission.email}`}
                                        className="text-base break-all hover:underline">
                                        {submission.email}
                                    </a>
                                </div>
                            )}
                            {submission.phone && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_phone")}
                                    </p>
                                    <a
                                        href={`tel:${submission.phone}`}
                                        className="text-base hover:underline">
                                        {submission.phone}
                                    </a>
                                </div>
                            )}
                            {submission.message && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_message")}
                                    </p>
                                    <p className="text-base whitespace-pre-wrap">
                                        {submission.message}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Raw Data */}
                    {Object.keys(submission.raw_data).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t(lang, "submission.form_data")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="max-w-full overflow-x-auto rounded-lg bg-muted p-4">
                                    <pre className="text-xs whitespace-pre-wrap break-all">
                                        {JSON.stringify(submission.raw_data, null, 2)}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notes */}
                    <SubmissionNotes submissionId={submission.id} notes={notes} />
                </div>

                <div className="space-y-6">
                    {/* Source Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "submission.source")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {submission.website_name && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_website")}
                                    </p>
                                    {submission.website_url ? (
                                        <a
                                            href={submission.website_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm hover:underline">
                                            {submission.website_name}
                                        </a>
                                    ) : (
                                        <p className="text-sm">{submission.website_name}</p>
                                    )}
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "submission.field_client")}
                                </p>
                                <p className="text-sm">{submission.client_name}</p>
                            </div>
                            {submission.form_name && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "leads.form")}
                                    </p>
                                    <p className="text-sm">{submission.form_name}</p>
                                </div>
                            )}
                            {submission.connector_label && (
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        {t(lang, "submission.field_connector")}
                                    </p>
                                    <p className="text-sm">
                                        {submission.connector_label}
                                        {submission.connector_kind && (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({submission.connector_kind})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "submission.field_channel")}
                                </p>
                                <p className="text-sm">{submission.source}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timestamps */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t(lang, "submission.timeline")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "submission.field_submitted")}
                                </p>
                                <p className="text-sm">{formatDate(submission.submitted_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    {t(lang, "submission.field_received")}
                                </p>
                                <p className="text-sm">{formatDate(submission.created_at)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageContainer>
    );
}
