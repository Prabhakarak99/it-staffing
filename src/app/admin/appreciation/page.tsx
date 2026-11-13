import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { APPRECIATION_SCREEN, PRIZE, appreciationBoard, ensureAppreciationAwards } from "@/lib/appreciation/data";
import { AppreciationView } from "./appreciation-view";

export const dynamic = "force-dynamic";

export default async function AppreciationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, APPRECIATION_SCREEN.path))) redirect("/admin");

  // Normally settled by the hourly worker; this covers the first visit on the 1st
  await ensureAppreciationAwards();
  return <AppreciationView board={await appreciationBoard(session)} prize={PRIZE} myId={session.userId} hasAccount={!!session.roleId} />;
}
