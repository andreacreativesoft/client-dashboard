import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { Website, Client } from "@/types/database";

export const metadata: Metadata = {
  title: "Websites",
};

type WebsiteWithClient = Website & { client: Pick<Client, "id" | "business_name"> | null };

export default async function WebsitesPage() {
  const supabase = await createClient();

  // Get all websites with their client info
  const { data: websites } = await supabase
    .from("websites")
    .select("*, client:clients(id, business_name)")
    .order("created_at", { ascending: false });

  const typedWebsites = (websites || []) as WebsiteWithClient[];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Websites</h1>
        <p className="text-sm text-muted-foreground">
          {typedWebsites.length} website{typedWebsites.length !== 1 ? "s" : ""}
        </p>
      </div>

      {typedWebsites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No websites yet. Add a client first, then add websites to them.
            </p>
            <Link
              href="/admin/clients"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              Go to Clients
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {typedWebsites.map((website) => (
            <Card key={website.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{website.name}</span>
                      <Badge variant={website.is_active ? "default" : "secondary"}>
                        {website.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {website.url}
                    </a>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Source: {website.source_type}</span>
                      <span>•</span>
                      {website.git_repo_url && (
                        <>
                          <a
                            href={website.git_repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                            </svg>
                            Git Repo
                          </a>
                          <span>•</span>
                        </>
                      )}
                      {website.client ? (
                        <Link
                          href={`/admin/clients/${website.client.id}`}
                          className="hover:underline"
                        >
                          Client: {website.client.business_name}
                        </Link>
                      ) : (
                        <span>No client</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${website.url.replace(/\/$/, "")}/wp-admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      title="Open WordPress Admin"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.443 12c0-.735.097-1.447.277-2.128l3.04 8.327A8.574 8.574 0 0 1 3.443 12zm8.557 8.557c-.725 0-1.426-.09-2.098-.26l2.229-6.478 2.283 6.257a.726.726 0 0 0 .056.103 8.507 8.507 0 0 1-2.47.378zm1.001-12.593c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.73 0-1.958-.095-1.958-.095-.401-.023-.448.591-.047.614 0 0 .378.047.778.071l1.155 3.166-1.622 4.868L7.45 8.036c.447-.024.85-.071.85-.071.401-.047.354-.637-.047-.614 0 0-1.205.095-1.982.095-.14 0-.305-.004-.478-.01A8.546 8.546 0 0 1 12 3.443c2.096 0 4.008.757 5.492 2.011-.035-.002-.069-.007-.105-.007-.73 0-1.246.636-1.246 1.317 0 .612.354 1.129.73 1.74.283.495.614 1.129.614 2.046 0 .636-.177 1.426-.518 2.39l-.68 2.27-2.459-7.317.002.001zm3.086 10.843l2.25-6.503c.42-1.052.56-1.893.56-2.641 0-.272-.018-.524-.05-.763a8.554 8.554 0 0 1 .711 3.1c0 2.551-1.134 4.835-2.921 6.393l-.55.414z"/>
                      </svg>
                      WP Admin
                    </a>
                    <Link
                      href={`/admin/clients/${website.client_id}`}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
