import type { Metadata } from "next";
import { getProfile } from "@/lib/actions/profile";
import { getClientsWithGBP } from "@/lib/actions/analytics";
import { getImpersonatedClientId } from "@/lib/impersonate";
import { GBPAnalytics } from "@/components/analytics/gbp-analytics";

export const metadata: Metadata = {
  title: "Business Profile",
};

export default async function BusinessProfilePage() {
  const [profile, clientsWithGBP] = await Promise.all([
    getProfile(),
    getClientsWithGBP(),
  ]);

  const isAdmin = profile?.role === "admin";
  const impersonatedClientId = isAdmin ? await getImpersonatedClientId() : null;

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Business Profile</h1>

      <GBPAnalytics
        clientsWithGBP={clientsWithGBP}
        isAdmin={isAdmin}
        initialClientId={impersonatedClientId || undefined}
      />
    </div>
  );
}
