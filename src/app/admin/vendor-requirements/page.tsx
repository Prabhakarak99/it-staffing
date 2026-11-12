import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";
import { getActiveAi } from "@/lib/ai/providers";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { VENDOR_REQ_SCREEN, emptyTally } from "@/lib/requirements/constants";
import { LIST_DAYS, listRequirements } from "@/lib/requirements/data";
import { myEmailSetup } from "@/lib/email-templates/data";
import { marketedConsultants } from "@/lib/requirements/audience";
import { VendorRequirementsView } from "./vendor-requirements-view";

export const dynamic = "force-dynamic";

export default async function VendorRequirementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) redirect("/admin");

  const manager = isManager(session);
  const tally = emptyTally();
  const [rows, ai, gmailReady, gmail, recruiterInboxes, consultantInboxes, me, emailSetup, marketed] = await Promise.all([
    listRequirements(session, manager ? { tally } : {}),
    getActiveAi(),
    isGmailConfigured(),
    prisma.gmailAccount.findUnique({ where: { userId: session.userId }, select: { email: true, lastError: true, reqScanAt: true } }),
    prisma.gmailAccount.count({ where: { lastError: null } }),
    prisma.consultantMailbox.count({ where: { lastError: null } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
    myEmailSetup(session.userId),
    manager ? Promise.resolve([]) : marketedConsultants(),
  ]);
  const inboxes = recruiterInboxes + consultantInboxes;

  return (
    <VendorRequirementsView
      initialRows={rows}
      days={LIST_DAYS}
      manager={manager}
      tally={manager ? tally : null}
      myBook={manager ? null : marketed.filter((c) => c.recruiterId === session.userId).map((c) => ({ name: c.name, technology: c.technology }))}
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
