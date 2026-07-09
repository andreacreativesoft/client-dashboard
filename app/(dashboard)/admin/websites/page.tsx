import type { Metadata } from "next";

import { PageContainer } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/server";

import { WebsitesList, type WebsiteWithClient } from "./websites-list";

export const metadata: Metadata = {
    title: "Websites",
};

export default async function WebsitesPage() {
    const supabase = await createClient();

    const { data: websites } = await supabase
        .from("websites")
        .select("*, client:clients(id, business_name)")
        .order("created_at", { ascending: false });

    const typedWebsites = (websites || []) as unknown as WebsiteWithClient[];

    return (
        <PageContainer>
            <WebsitesList websites={typedWebsites} />
        </PageContainer>
    );
}
