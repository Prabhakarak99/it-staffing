import { prisma } from "@/lib/prisma";
import { AiError, aiJson, getActiveAi } from "@/lib/ai/providers";
import { resumeText, saveResume } from "@/lib/files/resumes";
import { atsScore } from "./ats";
import { buildResumeDocx, resumeContentText, type TailoredResumeContent } from "./resume-docx";

const MAX_RESUME_CHARS = 30_000;
const MAX_JD_CHARS = 15_000;

const SYSTEM = `You are an expert IT staffing resume writer for the US contract market (C2C / W2).
Rewrite the consultant's resume so it is a strong, ATS-friendly match for the job description.

Rules:
- Keep every employer/client name, job title, location, date range, degree and certification exactly as in the original. Never invent employers, dates, degrees or certifications.
- Rewrite the professional summary as 8-12 strong bullet points aimed at this job.
- Rebuild technical skills into clear categories. Put the JD's tools and technologies first where the consultant's background supports them, using the JD's exact wording.
- For each role, write a one or two sentence project description and 8-15 responsibility bullets with strong action verbs, using JD terminology where it fits what the consultant did in that role. Add an "environment" line listing the tools used.
- Most recent role first. Keep the consultant's name. Do not include phone numbers, emails or addresses.
- jdKeywords: 20-40 must-have skills, tools, technologies and certifications from the job description, each written exactly as it appears in the JD (short terms, not sentences).

JSON shape:
{
  "name": string,
  "title": string,
  "summary": string[],
  "skills": [{ "category": string, "items": string[] }],
  "experience": [{ "client": string, "role": string, "location": string | null, "duration": string, "description": string | null, "responsibilities": string[], "environment": string | null }],
  "education": string[],
  "certifications": string[],
  "jdKeywords": string[]
}`;

const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : []);

/** Coerce the model's JSON into the shape the Word builder expects */
function normalize(raw: Record<string, unknown>, fallbackName: string): TailoredResumeContent & { jdKeywords: string[] } {
  const skills = Array.isArray(raw.skills) ? raw.skills : [];
  const experience = Array.isArray(raw.experience) ? raw.experience : [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    name: str(raw.name) ?? fallbackName,
    title: str(raw.title) ?? "",
    summary: asStrings(raw.summary),
    skills: skills
      .map((s: Record<string, unknown>) => ({ category: str(s?.category) ?? "Skills", items: asStrings(s?.items) }))
      .filter((s) => s.items.length > 0),
    experience: experience
      .map((e: Record<string, unknown>) => ({
        client: str(e?.client) ?? "",
        role: str(e?.role) ?? "",
        location: str(e?.location),
        duration: str(e?.duration) ?? "",
        description: str(e?.description),
        responsibilities: asStrings(e?.responsibilities),
        environment: str(e?.environment),
      }))
      .filter((e) => e.client || e.role),
    education: asStrings(raw.education),
    certifications: asStrings(raw.certifications),
    jdKeywords: asStrings(raw.jdKeywords),
  };
}

export interface JobDescriptionInput {
  text: string;
  jobTitle?: string | null;
  clientName?: string | null;
  technology?: string | null;
  /** When the JD was uploaded as a file: stored name and download name */
  file?: string | null;
  fileName?: string | null;
}

export interface TailorInput {
  consultantId: string;
  userId: string;
  /** Easy Submissions: the JD comes from this submission */
  submissionId?: string | null;
  /** Resumes tab: a pasted or uploaded JD */
  jd?: JobDescriptionInput;
}

/**
 * Rewrites a consultant's resume for a job description (a submission's, or one pasted / uploaded)
 * with the configured AI, saves it as Word, scores the original and the update against the JD's
 * key terms, and keeps the JD with it.
 */
export async function tailorResume({ consultantId, userId, submissionId = null, jd: givenJd }: TailorInput) {
  const [sub, consultant, ai] = await Promise.all([
    submissionId
      ? prisma.submission.findUnique({ where: { id: submissionId }, select: { id: true, technology: true, jobDescription: true, clientName: true } })
      : null,
    prisma.student.findUnique({ where: { id: consultantId }, select: { firstName: true, lastName: true, resumeFile: true } }),
    getActiveAi(),
  ]);
  if (submissionId && !sub) throw new AiError("Submission not found");
  if (!consultant) throw new AiError("Consultant not found");
  if (!ai) throw new AiError("No AI provider is set up. An admin can add one under Administration → AI Settings.");
  const jd: JobDescriptionInput = sub
    ? { text: sub.jobDescription ?? "", technology: sub.technology, clientName: sub.clientName }
    : givenJd ?? { text: "" };
  if (!jd.text.trim()) {
    throw new AiError(sub ? "This submission has no job description. Add the JD to the submission first." : "Paste or upload the job description first");
  }
  if (jd.text.trim().length < 100) throw new AiError("The job description is too short. Paste the full JD.");
  if (!consultant.resumeFile) throw new AiError("Upload the consultant's resume first");
  const role = [jd.jobTitle, jd.technology].filter(Boolean).join(", ") || "the role";

  const name = `${consultant.firstName} ${consultant.lastName}`.trim();
  const original = await resumeText(consultant.resumeFile);
  if (original.length < 200) throw new AiError("Could not read enough text from the resume. Upload a text-based PDF or a Word file (not a scanned image).");

  const raw = await aiJson<Record<string, unknown>>(ai, {
    system: SYSTEM,
    user: `JOB DESCRIPTION (${role}${jd.clientName ? `, client ${jd.clientName}` : ""}):\n${jd.text.slice(0, MAX_JD_CHARS)}\n\nORIGINAL RESUME OF ${name}:\n${original.slice(0, MAX_RESUME_CHARS)}`,
    maxTokens: 8000,
    timeoutMs: 170_000,
  });
  const content = normalize(raw, name);
  if (content.experience.length === 0 && content.summary.length === 0) throw new AiError("The AI returned an empty resume. Please try again.");

  // Fall back to the skill list if the model skipped the keywords
  const keywords = content.jdKeywords.length ? content.jdKeywords : content.skills.flatMap((s) => s.items).slice(0, 30);
  const before = atsScore(original, keywords);
  const after = atsScore(resumeContentText(content), keywords);

  const docx = await buildResumeDocx(content);
  const file = await saveResume(docx, "docx", "tailored");
  const safe = name.replace(/[^\w ]+/g, "").replace(/\s+/g, "_") || "Consultant";
  const tech = (jd.technology || jd.jobTitle || "Resume").replace(/[^\w ]+/g, "").replace(/\s+/g, "_").slice(0, 30);

  return prisma.tailoredResume.create({
    data: {
      submissionId,
      consultantId,
      jobTitle: jd.jobTitle?.trim() || null,
      clientName: jd.clientName?.trim() || null,
      technology: jd.technology?.trim() || null,
      jobDescription: jd.text.trim(),
      jdFile: jd.file ?? null,
      jdFileName: jd.fileName ?? null,
      createdById: userId,
      file,
      fileName: `${safe}_${tech}_Updated.docx`,
      atsBefore: before.score,
      atsAfter: after.score,
      keywords: { matched: after.matched, missing: after.missing },
      provider: ai.label,
      model: ai.model,
    },
  });
}
