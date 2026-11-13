import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { todayKey } from "@/lib/attendance/dates";
import { PROFIT_SCREEN, listConfirmations } from "@/lib/profit-sharing/data";
import { ProfitSharingView } from "./profit-sharing-view";

export const dynamic = "force-dynamic";

export default async function ProfitSharingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, PROFIT_SCREEN.path))) redirect("/admin");

  const { tab } = await searchParams;
  return <ProfitSharingView initialTab={tab === "calculator" ? "calculator" : "confirmations"} initialRows={await listConfirmations()} today={todayKey()} />;
}
