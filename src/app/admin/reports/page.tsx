export const dynamic = "force-dynamic";

import { ReportsView } from "./reports-view";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  return <ReportsView initialReport={pick("report")} initialPeriod={pick("period")} initialDate={pick("date")} />;
}
