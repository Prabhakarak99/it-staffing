import { NextRequest, NextResponse } from "next/server";
import { resumesAccess } from "@/lib/resumes/data";
import { MAX_RESUME_BYTES, extOf, resumeText, saveResume } from "@/lib/files/resumes";
import { getTailorJob, startTailorJob } from "@/lib/easy/tailor-jobs";

type RouteContext = { params: Promise<{ id: string }> };

const field = (form: FormData, key: string, max: number) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

/**
 * POST (multipart: jobTitle?, clientName?, technology?, jdText?, jdFile?) — starts an AI resume for
 * this JD; the uploaded JD file is kept with the result. Returns a job id to poll.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await resumesAccess(id);
  if (!access.ok) return access.response;

  const form = await req.formData();
  let text = field(form, "jdText", 50_000) ?? "";
  let jdFile: { file: string; fileName: string } | null = null;

  const upload = form.get("jdFile");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_RESUME_BYTES) return NextResponse.json({ error: "The JD file must be under 10 MB" }, { status: 400 });
    const ext = extOf(upload.name);
    if (!["pdf", "docx", "txt"].includes(ext)) return NextResponse.json({ error: "Upload the JD as PDF, Word (.docx) or .txt" }, { status: 400 });
    const stored = await saveResume(Buffer.from(await upload.arrayBuffer()), ext, "jd");
    jdFile = { file: stored, fileName: upload.name.slice(0, 200) };
    // Pasted text wins; otherwise read the JD from the file
    if (!text) {
      try {
        text = await resumeText(stored);
      } catch {
        return NextResponse.json({ error: "Could not read the JD file. Paste the JD text instead." }, { status: 400 });
      }
    }
  }
  if (!text.trim()) return NextResponse.json({ error: "Paste the job description or upload it as a file" }, { status: 400 });

  const jobId = startTailorJob({
    consultantId: id,
    userId: access.session.userId,
    jd: {
      text,
      jobTitle: field(form, "jobTitle", 200),
      clientName: field(form, "clientName", 200),
      technology: field(form, "technology", 100),
      file: jdFile?.file,
      fileName: jdFile?.fileName,
    },
  });
  return NextResponse.json({ jobId }, { status: 202 });
}

/** GET ?job= — running | done (with the result) | failed (with the reason) */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const access = await resumesAccess(id);
  if (!access.ok) return access.response;

  const job = getTailorJob(req.nextUrl.searchParams.get("job") ?? "", access.session.userId);
  if (!job) return NextResponse.json({ error: "This update is no longer available. Please try again." }, { status: 404 });
  return NextResponse.json({ status: job.status, result: job.result, error: job.error });
}
