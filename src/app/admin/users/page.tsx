export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { UsersView } from "./users-view";

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <UsersView users={users} roles={roles} />;
}
