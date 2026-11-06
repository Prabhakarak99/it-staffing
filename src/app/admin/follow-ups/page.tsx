import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { fmtDayKey, todayKey } from "@/lib/attendance/dates";
import { listFollowUps } from "@/lib/followups/data";
import { FOLLOWUPS_SCREEN } from "@/lib/followups/templates";
import { FollowUpsView } from "./follow-ups-view";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, FOLLOWUPS_SCREEN.path))) redirect("/admin");

  const [items, gmailReady, gmail] = await Promise.all([
    listFollowUps(session.userId),
    isGmailConfigured(),
    prisma.gmailAccount.findUnique({ where: { userId: session.userId }, select: { email: true, lastError: true } }),
  ]);

  return (
    <FollowUpsView
      initialItems={items}
      userId={session.userId}
      canSeeAll={isManager(session)}
      gmail={gmailReady && gmail && !gmail.lastError ? gmail.email : null}
      dayLabel={fmtDayKey(todayKey(), { weekday: "long", month: "long", day: "numeric" })}
    />
  );
}
