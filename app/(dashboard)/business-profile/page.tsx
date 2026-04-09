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
  // Impersonation takes priority over header dropdown selection
  const activeClientId = impersonatedClientId || selectedClientId;

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>Google Business Profile</h1>

      <GBPAnalytics
        clientsWithGBP={clientsWithGBP}
        isAdmin={isAdmin}
        initialClientId={activeClientId || undefined}
      />
    </div>
  );
}
