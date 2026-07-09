import type { Metadata } from "next";

import { PageContainer } from "@/components/ui/page";
import { getClients } from "@/lib/actions/clients";
import { getPendingInvites } from "@/lib/actions/invites";
import { getUsers } from "@/lib/actions/users";
import { createClient } from "@/lib/supabase/server";

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
        <PageContainer>
            <UsersList
                users={users}
                clients={clients}
                pendingInvites={pendingInvites}
                currentUserId={user?.id || ""}
            />
        </PageContainer>
    );
}
