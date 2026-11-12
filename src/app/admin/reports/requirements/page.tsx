import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { addKeyDays, dayKeyOf } from "@/lib/tz";
import { requirementReport } from "@/lib/requirements/report";
import { RequirementReportView } from "./requirement-report-view";

export const dynamic = "force-dynamic";

const MAX_DAYS = 31;
const isKey = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function RequirementReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, "/admin/reports"))) redirect("/admin");

  const sp = await searchParams;
  const today = dayKeyOf();
  let to = isKey(sp.to) && sp.to <= today ? sp.to : today;
  let from = isKey(sp.from) ? sp.from : addKeyDays(to, -6);
  if (from > to) [from, to] = [to, from];
  if (from < addKeyDays(to, -(MAX_DAYS - 1))) from = addKeyDays(to, -(MAX_DAYS - 1));

  return <RequirementReportView from={from} to={to} today={today} maxDays={MAX_DAYS} report={await requirementReport(from, to)} />;
}
