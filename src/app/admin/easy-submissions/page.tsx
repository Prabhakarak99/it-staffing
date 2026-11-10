import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/roles";
import { canManageUsers } from "@/lib/user-safe";
import { canUseEasy } from "@/lib/easy/access";
import { fmtDayKey, todayKey } from "@/lib/attendance/dates";
import { todaysSubmissions } from "@/lib/easy/data";
import { getActiveAi } from "@/lib/ai/providers";
import { myEmailSetup } from "@/lib/email-templates/data";
import { EasySubmissionsView } from "./easy-view";

export const dynamic = "force-dynamic";

export default async function EasySubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canUseEasy(session))) redirect("/admin");

  const [submissions, ai, me, emailSetup] = await Promise.all([
    todaysSubmissions(session),
    getActiveAi(),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
    myEmailSetup(session.userId),
  ]);

  return (
    <EasySubmissionsView
      submissions={submissions}
      showRecruiter={isManager(session)}
      dayLabel={fmtDayKey(todayKey(), { weekday: "long", month: "long", day: "numeric" })}
      ai={ai ? { label: ai.label, model: ai.model } : null}
      canManageAccess={canManageUsers(session)}
      sender={{
        name: me ? `${me.firstName} ${me.lastName}`.trim() : session.email,
        email: me?.email ?? session.email,
        signature: emailSetup.signature,
        templates: emailSetup.templates.filter((t) => t.category === "submission" || t.category === "general"),
      }}
    />
  );
}
