import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVendorAccess } from "@/lib/vendors/access";
import { listVendors } from "@/lib/vendors/list";
import { getActiveAi } from "@/lib/ai/providers";
import { myEmailSetup } from "@/lib/email-templates/data";
import { VendorManagementView } from "./vendor-management-view";

export const dynamic = "force-dynamic";

export default async function VendorManagementPage() {
  const access = await getVendorAccess();
  if (!access.ok) redirect(access.status === 401 ? "/login" : "/admin");
  const { userId, email } = access.session;
  const [initial, ai, me, emailSetup] = await Promise.all([
    listVendors(access),
    getActiveAi(),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
    myEmailSetup(userId),
  ]);
  return (
    <VendorManagementView
      initial={initial}
      aiReady={!!ai}
      sender={{
        name: me ? `${me.firstName} ${me.lastName}`.trim() : email,
        email: me?.email ?? email,
        signature: emailSetup.signature,
        templates: emailSetup.templates.filter((t) => t.category === "submission" || t.category === "general"),
      }}
    />
  );
}
