export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { UsersView } from "./users-view";
import { SAFE_USER_OMIT } from "@/lib/user-safe";

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: { role: true },
      omit: SAFE_USER_OMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <UsersView users={users} roles={roles} />;
}
