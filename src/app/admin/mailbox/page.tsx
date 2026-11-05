import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { canManageUsers } from "@/lib/user-safe";
import { MAILBOX_SCREEN } from "@/lib/gmail/access";
import { getEmailActivity } from "@/lib/gmail/activity";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { getGmailSetup } from "@/lib/gmail/setup";
import { MailboxView } from "./mailbox-view";

export const dynamic = "force-dynamic";

export default async function MailboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, MAILBOX_SCREEN.path))) redirect("/admin");

  const { gmail, message } = await searchParams;
  const banner =
    gmail === "connected" ? { type: "success" as const, text: "Gmail connected. Your counts are being calculated." }
    : gmail === "denied" ? { type: "error" as const, text: "Gmail access was not allowed." }
    : gmail === "error" ? { type: "error" as const, text: message || "Could not connect Gmail." }
    : null;

  const isAdmin = canManageUsers(session);
  return (
    <MailboxView
      configured={await isGmailConfigured()}
      setup={isAdmin ? await getGmailSetup() : null}
      activity={await getEmailActivity(session.userId, isAdmin)}
      banner={banner}
    />
  );
}
