import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/attendance/dates";
import { canOpenIncentives, incentiveBoard, listPlacements, seesAllIncentives } from "@/lib/incentives/data";
import { IncentivesView } from "./incentives-view";

export const dynamic = "force-dynamic";

export default async function IncentivesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canOpenIncentives(session))) redirect("/admin");

  const tab = (await searchParams).tab === "calculations" ? "calculations" : "placements";
  const today = todayKey();
  return (
    <IncentivesView
      tab={tab}
      today={today}
      all={seesAllIncentives(session)}
      placements={tab === "placements" ? await listPlacements(session) : []}
      board={tab === "calculations" ? await incentiveBoard(session, today) : []}
    />
  );
}
