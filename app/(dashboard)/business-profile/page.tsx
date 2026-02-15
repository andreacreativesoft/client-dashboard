import type { Metadata } from "next";
import { getProfile } from "@/lib/actions/profile";
import { getClientsWithGBP } from "@/lib/actions/analytics";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { getSelectedClientId } from "@/lib/selected-client";
import { GBPAnalytics } from "@/components/analytics/gbp-analytics";

export const metadata: Metadata = {
  title: "Google Business Profile",
};

export default async function BusinessProfilePage() {
  const [profile, clientsWithGBP] = await Promise.all([
    getProfile(),
    getClientsWithGBP(),
  ]);

  const isAdmin = profile?.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;
  const selectedClientId = isAdmin ? await getSelectedClientId() : null;
  const activeClientId = selectedClientId || impersonatedClientId;

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Google Business Profile</h1>

      <GBPAnalytics
        clientsWithGBP={clientsWithGBP}
        isAdmin={isAdmin}
        initialClientId={activeClientId || undefined}
      />
    </div>
  );
}
