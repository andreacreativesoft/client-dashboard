import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { Profile } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <Sidebar isAdmin={isAdmin} className="hidden md:flex" />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <Header
          userName={profile?.full_name || user.email || "User"}
          isAdmin={isAdmin}
        />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav isAdmin={isAdmin} className="md:hidden" />
    </div>
  );
}
