import { cookies } from "next/headers";

const SELECTED_CLIENT_COOKIE = "selected_client_id";

export async function getSelectedClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SELECTED_CLIENT_COOKIE)?.value || null;
}

export async function setSelectedClientId(clientId: string | null): Promise<void> {
  const cookieStore = await cookies();

  if (clientId) {
    cookieStore.set(SELECTED_CLIENT_COOKIE, clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } else {
    cookieStore.delete(SELECTED_CLIENT_COOKIE);
  }
}
