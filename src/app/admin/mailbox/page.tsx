import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { canManageUsers } from "@/lib/user-safe";
import { MAILBOX_SCREEN } from "@/lib/gmail/access";
import { getEmailActivity } from "@/lib/gmail/activity";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { getGmailSetup } from "@/lib/gmail/setup";
import { MailboxView } from "./mailbox-view";
import { prisma } from "@/lib/prisma";
import { myEmailSetup } from "@/lib/email-templates/data";

export const dynamic = "force-dynamic";

export default async function MailboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, MAILBOX_SCREEN.path))) redirect("/admin");

  const { gmail, message, open } = await searchParams;
  const banner =
    gmail === "connected" ? { type: "success" as const, text: "Gmail connected. Your counts are being calculated." }
    : gmail === "denied" ? { type: "error" as const, text: "Gmail access was not allowed." }
    : gmail === "error" ? { type: "error" as const, text: message || "Could not connect Gmail." }
    : null;

  const isAdmin = canManageUsers(session);
  const [emailSetup, me] = await Promise.all([
    myEmailSetup(session.userId),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
  ]);
  return (
    <MailboxView
      configured={await isGmailConfigured()}
      setup={isAdmin ? await getGmailSetup() : null}
      activity={await getEmailActivity(session.userId, isAdmin)}
      banner={banner}
      emailSetup={emailSetup}
      me={{ name: me ? `${me.firstName} ${me.lastName}`.trim() : session.email, email: me?.email ?? session.email }}
      open={open === "signature" || open === "templates" ? open : null}
    />
  );
}
