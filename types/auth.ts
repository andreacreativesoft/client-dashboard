import type { Profile, UserRole } from "./database";

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

export interface SessionContext {
  user: AuthUser | null;
  isAdmin: boolean;
  clientIds: string[];
}

export function isAdmin(role: UserRole): role is "admin" {
  return role === "admin";
}
