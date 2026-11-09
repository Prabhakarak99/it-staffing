import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { canViewScreen } from "@/lib/screen-access";
import { getActiveAi } from "@/lib/ai/providers";
import { RESUMES_SCREEN, listResumeConsultants } from "@/lib/resumes/data";
import { ResumesView } from "./resumes-view";

export const dynamic = "force-dynamic";

export default async function ResumesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canViewScreen(session, RESUMES_SCREEN.path))) redirect("/admin");

  const [consultants, ai, sp] = await Promise.all([listResumeConsultants(session), getActiveAi(), searchParams]);

  return (
    <ResumesView
      consultants={consultants}
      showRecruiter={isManager(session)}
      ai={ai ? { label: ai.label, model: ai.model } : null}
      initialId={consultants.some((c) => c.id === sp.consultant) ? sp.consultant! : null}
    />
  );
}
