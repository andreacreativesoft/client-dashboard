import type { Metadata } from "next";
import { getInviteByToken } from "@/lib/actions/invites";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = {
  title: "Accept Invitation",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { invite, error } = await getInviteByToken(token);

  if (error || !invite) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <div className="mb-4 flex justify-center">
            <svg
              className="h-12 w-12 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold">Invalid Invitation</h1>
          <p className="text-sm text-muted-foreground">
            {error || "This invitation link is invalid or has expired."}
          </p>
          <a
            href="/login"
            className="mt-4 inline-block text-sm text-foreground underline hover:no-underline"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  // Check if user needs to fill in name (invite mode without pre-filled info)
  const needsProfileInfo = !invite.full_name;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsProfileInfo
              ? "Complete your profile and set your password"
              : "Set your password to complete setup"}
          </p>
        </div>

        {!needsProfileInfo && (
          <div className="mb-6 rounded-lg bg-muted p-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{invite.email}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">{invite.full_name}</span>
            </p>
          </div>
        )}

        <AcceptInviteForm
          token={token}
          email={invite.email}
          needsProfileInfo={needsProfileInfo}
        />
      </div>
    </div>
  );
}
