import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { myEmailSetup } from "@/lib/email-templates/data";
import { EMAIL_TEMPLATES_SCREEN } from "@/lib/email-templates/render";
import { EmailTemplatesView } from "./email-templates-view";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, EMAIL_TEMPLATES_SCREEN.path))) redirect("/admin");

  const [setup, me] = await Promise.all([
    myEmailSetup(session.userId),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
  ]);

  return (
    <EmailTemplatesView
      initial={setup}
      me={{ name: me ? `${me.firstName} ${me.lastName}`.trim() : session.email, email: me?.email ?? session.email }}
    />
  );
}
