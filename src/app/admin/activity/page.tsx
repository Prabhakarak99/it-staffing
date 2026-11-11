import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { ACTIVITY_SCREEN } from "@/lib/activity/log";
import { PAGE_SIZE, loadActivity, readFilters } from "@/lib/activity/data";
import { ActivityView } from "./activity-view";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, ACTIVITY_SCREEN.path))) redirect("/admin");

  const filters = readFilters(await searchParams);
  const data = await loadActivity(filters);
  return <ActivityView filters={filters} pageSize={PAGE_SIZE} {...data} />;
}
