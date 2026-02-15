import type { Metadata } from "next";
import { getProfile } from "@/lib/actions/profile";
import { getClientsWithGSC } from "@/lib/actions/analytics";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { getSelectedClientId } from "@/lib/selected-client";
import { GSCAnalytics } from "@/components/analytics/gsc-analytics";

export const metadata: Metadata = {
  title: "Google Search Console",
};

export default async function SearchConsolePage() {
  const [profile, clientsWithGSC] = await Promise.all([
    getProfile(),
    getClientsWithGSC(),
  ]);

  const isAdmin = profile?.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;
  const selectedClientId = isAdmin ? await getSelectedClientId() : null;
  const activeClientId = selectedClientId || impersonatedClientId;

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Google Search Console</h1>

      <GSCAnalytics
        clientsWithGSC={clientsWithGSC}
        isAdmin={isAdmin}
        initialClientId={activeClientId || undefined}
      />
    </div>
  );
}
