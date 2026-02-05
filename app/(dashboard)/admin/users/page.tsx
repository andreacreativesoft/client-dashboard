import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsers } from "@/lib/actions/users";
import { getClients } from "@/lib/actions/clients";
import { getPendingInvites } from "@/lib/actions/invites";
import { UsersList } from "./users-list";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [users, clients, pendingInvites] = await Promise.all([
    getUsers(),
    getClients(),
    getPendingInvites(),
  ]);

  return (
    <div className="p-4 md:p-6">
      <UsersList
        users={users}
        clients={clients}
        pendingInvites={pendingInvites}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}
