import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AIAnalysis } from "./ai-analysis";
import { DebugLogViewer } from "@/components/wordpress/debug-log-viewer";
import type { Website, Client } from "@/types/database";

export const metadata: Metadata = {
  title: "Website Detail",
};

type WebsiteWithClient = Website & {
  client: Pick<Client, "id" | "business_name"> | null;
};

export default async function WebsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: website } = await supabase
    .from("websites")
    .select("*, client:clients(id, business_name)")
    .eq("id", id)
    .single();

  if (!website) notFound();

  const typedWebsite = website as WebsiteWithClient;

  return (
    <div className="p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/admin/websites" className="hover:underline">
          Websites
        </Link>
        <span>/</span>
        <span className="text-foreground">{typedWebsite.name}</span>
      </div>

      {/* Website header */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{typedWebsite.name}</h1>
                <Badge variant={typedWebsite.is_active ? "default" : "secondary"}>
                  {typedWebsite.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <a
                href={typedWebsite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                {typedWebsite.url}
              </a>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Source: {typedWebsite.source_type}</span>
                {typedWebsite.client && (
                  <>
                    <span>-</span>
                    <Link
                      href={`/admin/clients/${typedWebsite.client.id}`}
                      className="hover:underline"
                    >
                      Client: {typedWebsite.client.business_name}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`${typedWebsite.url.replace(/\/$/, "")}/wp-admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                title="Open WordPress Admin"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.443 12c0-.735.097-1.447.277-2.128l3.04 8.327A8.574 8.574 0 0 1 3.443 12zm8.557 8.557c-.725 0-1.426-.09-2.098-.26l2.229-6.478 2.283 6.257a.726.726 0 0 0 .056.103 8.507 8.507 0 0 1-2.47.378zm1.001-12.593c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.73 0-1.958-.095-1.958-.095-.401-.023-.448.591-.047.614 0 0 .378.047.778.071l1.155 3.166-1.622 4.868L7.45 8.036c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.14 0-.305-.004-.478-.01A8.546 8.546 0 0 1 12 3.443c2.096 0 4.008.757 5.492 2.011-.035-.002-.069-.007-.105-.007-.73 0-1.246.636-1.246 1.317 0 .612.354 1.129.73 1.74.283.495.614 1.129.614 2.046 0 .636-.177 1.426-.518 2.39l-.68 2.27-2.459-7.317.002.001zm3.086 10.843l2.25-6.503c.42-1.052.56-1.893.56-2.641 0-.272-.018-.524-.05-.763a8.554 8.554 0 0 1 .711 3.1c0 2.551-1.134 4.835-2.921 6.393l-.55.414z" />
                </svg>
                WP Admin
              </a>
              {typedWebsite.client && (
                <Link
                  href={`/admin/clients/${typedWebsite.client.id}`}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Client Detail
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Log */}
      <div className="mb-6">
        <DebugLogViewer websiteId={id} />
      </div>

      {/* AI Analysis */}
      <AIAnalysis websiteId={id} />
    </div>
  );
}
