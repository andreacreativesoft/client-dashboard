import { cookies } from "next/headers";

const IMPERSONATE_COOKIE = "impersonate_client_id";

export async function getImpersonatedClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value || null;
}

export async function setImpersonatedClientId(clientId: string | null): Promise<void> {
  const cookieStore = await cookies();

  if (clientId) {
    cookieStore.set(IMPERSONATE_COOKIE, clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
  } else {
    cookieStore.delete(IMPERSONATE_COOKIE);
  }
}
