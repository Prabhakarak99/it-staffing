import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";
import { getActiveAi } from "@/lib/ai/providers";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { LIST_DAYS, listRequirements } from "@/lib/requirements/data";
import { myEmailSetup } from "@/lib/email-templates/data";
import { VendorRequirementsView } from "./vendor-requirements-view";

export const dynamic = "force-dynamic";

export default async function VendorRequirementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) redirect("/admin");

  const [rows, ai, gmailReady, gmail, recruiterInboxes, consultantInboxes, me, emailSetup] = await Promise.all([
    listRequirements(session),
    getActiveAi(),
    isGmailConfigured(),
    prisma.gmailAccount.findUnique({ where: { userId: session.userId }, select: { email: true, lastError: true, reqScanAt: true } }),
    prisma.gmailAccount.count({ where: { lastError: null } }),
    prisma.consultantMailbox.count({ where: { lastError: null } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
    myEmailSetup(session.userId),
  ]);
  const inboxes = recruiterInboxes + consultantInboxes;

  return (
    <VendorRequirementsView
      initialRows={rows}
      days={LIST_DAYS}
      manager={isManager(session)}
      aiReady={!!ai}
      inboxes={inboxes}
      sender={{
        name: me ? `${me.firstName} ${me.lastName}`.trim() : session.email,
        email: me?.email ?? session.email,
        signature: emailSetup.signature,
        templates: emailSetup.templates.filter((t) => t.category === "submission" || t.category === "general"),
      }}
      myInbox={gmailReady && gmail && !gmail.lastError ? { email: gmail.email, scannedAt: gmail.reqScanAt?.toISOString() ?? null } : null}
    />
  );
}
