import type { Metadata } from "next";

import { getInviteByToken } from "@/lib/actions/invites";

import { InviteClient } from "./invite-client";

export const metadata: Metadata = {
    title: "Accepter l'invitation",
};

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const { invite, error } = await getInviteByToken(token);

    if (error || !invite) {
        return (
            <InviteClient
                invalid
                errorMessage={error}
                token={token}
                email=""
                needsProfileInfo={false}
            />
        );
    }

    return (
        <InviteClient
            invalid={false}
            token={token}
            email={invite.email}
            fullName={invite.full_name}
            // Client needs to fill in name when the invite has no pre-filled info.
            needsProfileInfo={!invite.full_name}
        />
    );
}
