import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { CONSULTANT_MAIL_SCREEN, listConsultantMailboxes } from "@/lib/consultant-mail/data";
import { ConsultantEmailsView } from "./consultant-emails-view";

export const dynamic = "force-dynamic";

export default async function ConsultantEmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, CONSULTANT_MAIL_SCREEN.path))) redirect("/admin");

  const [rows, gmailReady, sp] = await Promise.all([listConsultantMailboxes(session), isGmailConfigured(), searchParams]);

  return (
    <ConsultantEmailsView
      rows={rows}
      manager={isManager(session)}
      gmailReady={gmailReady}
      result={sp.gmail ? { kind: sp.gmail, message: sp.message ?? null, email: sp.email ?? null, name: sp.name ?? null } : null}
    />
  );
}
