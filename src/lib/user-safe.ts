import type { Role, User } from "@/generated/prisma/client";

/** Never send these to the browser: pass as `omit` on every user query that leaves the server. */
export const SAFE_USER_OMIT = { password: true, activationToken: true, resetToken: true } as const;

export type SafeUser = Omit<User, keyof typeof SAFE_USER_OMIT>;
export type SafeUserWithRole = SafeUser & { role: Role | null };

/** Admins = Super Admin (no role restrictions) or anyone whose role can open the Users screen */
export function canManageUsers(session: { allowedScreens: string[] | null } | null) {
  return !!session && (session.allowedScreens === null || session.allowedScreens.includes("/admin/users"));
}
