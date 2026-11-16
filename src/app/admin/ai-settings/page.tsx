import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/user-safe";
import { listAiProviders } from "@/lib/ai/admin";
import { listJobApis } from "@/lib/jobfeed/apis";
import { AiSettingsView } from "./ai-settings-view";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageUsers(session)) redirect("/admin");
  const [providers, jobApis] = await Promise.all([listAiProviders(), listJobApis()]);
  return <AiSettingsView providers={providers} jobApis={jobApis} />;
}
