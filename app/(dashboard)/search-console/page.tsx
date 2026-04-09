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
  // Impersonation takes priority over header dropdown selection
  const activeClientId = impersonatedClientId || selectedClientId;

  return (
    <div className="px-8 py-12">
      <h1 className="mb-6 text-[30px] font-extrabold uppercase leading-[1.3] tracking-[-0.9px] text-[#2E2E2E]" style={{ fontFamily: "var(--font-mplus1), sans-serif" }}>Google Search Console</h1>

      <GSCAnalytics
        clientsWithGSC={clientsWithGSC}
        isAdmin={isAdmin}
        initialClientId={activeClientId || undefined}
      />
    </div>
  );
}
