export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { UserList } from "./user-list";
import { CreateUserForm } from "./create-user-form";

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <Header title="Users" />
      <div className="p-6 space-y-6">
        <CreateUserForm roles={roles} />
        <UserList users={users} />
      </div>
    </>
  );
}
