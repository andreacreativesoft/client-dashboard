import { requireAgencyView } from "@/lib/view-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Admin-only space. Redirects clients and admins currently impersonating a client.
    await requireAgencyView();

    return <>{children}</>;
}
