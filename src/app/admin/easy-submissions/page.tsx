import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { isManager } from "@/lib/roles";
import { fmtDayKey, todayKey } from "@/lib/attendance/dates";
import { EASY_SCREEN, todaysSubmissions } from "@/lib/easy/data";
import { getActiveAi } from "@/lib/ai/providers";
import { EasySubmissionsView } from "./easy-view";

export const dynamic = "force-dynamic";

export default async function EasySubmissionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, EASY_SCREEN.path))) redirect("/admin");

  const [submissions, ai, me] = await Promise.all([
    todaysSubmissions(session),
    getActiveAi(),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
  ]);

  return (
    <EasySubmissionsView
      submissions={submissions}
      showRecruiter={isManager(session)}
      dayLabel={fmtDayKey(todayKey(), { weekday: "long", month: "long", day: "numeric" })}
      ai={ai ? { label: ai.label, model: ai.model } : null}
      sender={{ name: me ? `${me.firstName} ${me.lastName}`.trim() : session.email, email: me?.email ?? session.email }}
    />
  );
}
