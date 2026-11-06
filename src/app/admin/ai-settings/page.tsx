import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/user-safe";
import { listAiProviders } from "@/lib/ai/admin";
import { AiSettingsView } from "./ai-settings-view";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageUsers(session)) redirect("/admin");
  return <AiSettingsView providers={await listAiProviders()} />;
}
