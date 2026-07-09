import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// No standalone website page — redirect to the client file with the site's tab opened.
export default async function WebsiteDetailRedirect({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: website } = await supabase
        .from("websites")
        .select("client_id")
        .eq("id", id)
        .single<{ client_id: string }>();

    if (!website) notFound();

    redirect(`/admin/clients/${website.client_id}?site=${id}`);
}
