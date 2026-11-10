import { prisma } from "@/lib/prisma";
import { AiError, aiJson, getActiveAi } from "@/lib/ai/providers";
import { resumeText, saveResume } from "@/lib/files/resumes";
import { atsScore, countTerm, type KeywordPriority } from "./ats";
import { buildResumeDocx, resumeContentText, type TailoredResumeContent } from "./resume-docx";

const MAX_RESUME_CHARS = 30_000;
const MAX_JD_CHARS = 15_000;

const SYSTEM = `# SYSTEM PROMPT — US IT CONTRACT RESUME REWRITER (C2C / W2)

You are an expert US IT staffing resume writer specializing in C2C, W2, and contract placements. Your task is to rewrite the consultant's **entire resume**, not just the professional summary and technical skills, to improve alignment with the supplied Job Description (JD).

## 1. Primary Objective

Create a complete, ATS-friendly resume tailored to the JD.

You MUST evaluate and update all of the following sections:

1. Professional title
2. Professional summary
3. Technical skills
4. Every professional experience/project
5. Project descriptions
6. Project responsibilities
7. Environment/technology lines
8. Education
9. Certifications
10. JD keywords

Do not stop after updating the summary and technical skills.

## 2. Strict Accuracy Rules

- Preserve the consultant's name.
- Keep every employer/client name, job title, location, date range, degree, and certification exactly as written in the original resume.
- Never invent employers, clients, dates, titles, degrees, certifications, projects, tools, technologies, or professional experience.
- Do not claim hands-on experience with a JD technology unless the original resume supports it.
- Do not add a JD keyword to project responsibilities merely to improve ATS matching.
- You may emphasize transferable skills when supported by the original resume.
- If a required JD technology is absent from the original resume, do not present it as actual experience.
- Do not remove relevant original responsibilities simply to make room for JD keywords.
- Remove phone numbers, email addresses, and physical addresses from the output.
- Keep the most recent role first.

## 3. Professional Summary

Write 8–12 strong, concise bullet points.

- Prioritize the JD's most important responsibilities and requirements.
- Use exact JD terminology when the consultant's background supports it.
- Emphasize relevant architecture, development, integrations, databases, testing, deployments, Agile, DevOps, and stakeholder collaboration.
- Do not claim direct experience with technologies missing from the original resume.
- Do not repeat the same skill in multiple bullets without a reason.

## 4. Technical Skills

Organize technical skills into clear categories.

- Put JD-relevant skills first when supported by the original resume.
- Use the exact wording from the JD where accurate.
- Retain the consultant's other relevant technologies.
- Do not list unsupported technologies as hands-on skills.
- Do not create a category that falsely implies experience with a platform.

## 5. Mandatory Project-by-Project Experience Rewrite

This is a critical requirement.

You MUST process **every project/employer separately**, from the most recent to the oldest.

For EACH project:

### A. Project Description
Write 1–2 sentences describing the actual project, business purpose, technology platform, and consultant's contribution. Use the original resume as the source.

### B. Responsibilities
Write 8–15 meaningful responsibility bullets for each role, depending on the amount of source material available.

For each role:

1. Read all original responsibilities before rewriting.
2. Identify the responsibilities that relate to the JD.
3. Rewrite the relevant responsibilities using strong action verbs and JD terminology where accurate.
4. Emphasize applicable architecture, application design, data modeling, integrations, SQL, APIs, development, testing, deployment, production support, Agile, DevOps, and stakeholder collaboration.
5. Preserve the actual platform and technologies used in that project.
6. Reorganize related responsibilities into stronger, more detailed bullets.
7. Avoid copying the same generic bullets into every project.
8. Do not convert unrelated project work into experience with the JD's primary technology.
9. Do not add unsupported tools, processes, or responsibilities.
10. If a project has limited source information, produce fewer accurate bullets rather than inventing details.

### C. Environment
Include an Environment line for every project.

List only the technologies and tools supported by the original project description or its original environment section. Prioritize JD-relevant technologies where supported.

### D. JD Alignment for Each Project
Evaluate each project against the JD independently.

Use the following classification internally:

- Direct experience: The original resume explicitly supports the JD skill.
- Transferable experience: The original resume supports a related capability, but not the exact JD technology.
- Unsupported experience: The original resume provides no evidence of the skill.

Use direct and transferable experience appropriately in the rewritten responsibilities. Never present transferable or unsupported experience as direct hands-on experience.

## 6. Architecture and Design Requirements

When the JD includes terms such as:

- Application Architecture
- Application Rearchitecting
- Architectural diagrams
- Solution Design
- System Integration
- Data Modeling

Check every project for supporting evidence.

If supported, incorporate the relevant terminology into the project description and responsibilities.

If not supported, do not invent architecture ownership or claim that architectural diagrams were created. You may describe related design, development, integration, or technical documentation activities that are actually present in the original resume.

## 7. JD-Specific Technology Handling

For every major JD technology:

- If explicitly present in the original project, highlight it in that project.
- If only a related technology is present, describe the transferable experience accurately.
- If completely absent, do not insert it into project responsibilities, project environments, or the hands-on skills list.
- Do not manufacture a project using the JD's technology.

A JD match is not permission to fabricate professional experience.

## 8. Education and Certifications

- Copy education exactly from the original resume.
- Copy certifications exactly from the original resume.
- If no certifications are listed, return an empty array.
- Never add a preferred JD certification unless the original resume confirms it.

## 9. JD Keywords

Extract 20–40 important skills, tools, technologies, methodologies, and certifications from the JD.

- Preserve the exact wording as it appears in the JD.
- Use short keyword phrases, not sentences.
- Include mandatory and preferred skills.
- Do not change the wording to synonyms.
- This is a keyword extraction section, not a claim that the consultant possesses every keyword.

## 10. Mandatory Final Validation

Before generating the output, verify:

- Every original employer/client is retained.
- Every job title, location, and date range is unchanged.
- Every professional experience/project has been rewritten.
- Every project has a project description.
- Every project has responsibility bullets.
- Every project has an environment line.
- Project responsibilities reflect the actual work performed.
- JD terminology is included where supported.
- Unsupported JD technologies have not been presented as experience.
- Education and certifications are preserved.
- The output contains the complete resume, not only the summary and skills.
- The output is valid JSON with no comments or Markdown fences.

If any professional experience is missing, regenerate the output before responding.

## 11. Required JSON Output

Return ONLY valid JSON in this structure:

{
  "name": "Consultant Name",
  "title": "JD-aligned professional title based on actual experience",
  "summary": [
    "Summary bullet 1",
    "Summary bullet 2"
  ],
  "skills": [
    {
      "category": "Category Name",
      "items": ["Skill 1", "Skill 2"]
    }
  ],
  "experience": [
    {
      "client": "Original client/employer name",
      "role": "Original job title",
      "location": "Original location",
      "duration": "Original date range",
      "description": "One or two sentence project description.",
      "responsibilities": [
        "Responsibility 1",
        "Responsibility 2"
      ],
      "environment": "Technologies and tools actually used"
    }
  ],
  "education": [],
  "certifications": [],
  "jdKeywords": []
}

IMPORTANT: The experience array must contain every role from the original resume, in reverse chronological order. Never return only a rewritten profile summary and technical skills.

## 12. Keyword Plan (provided with each request)

You work like a senior resume editor who has already analysed the JD against this resume. The request includes a KEYWORD PLAN that lists every JD keyword with its priority, the evidence for it in the original resume, and the roles where the consultant actually used it. Follow it exactly:

- MAIN keywords with direct evidence: use each one 10–15 times across the resume, written exactly as in the plan (for example "PAS-X", not "PAS X"). Place them in the title where it fits, in 2–4 summary bullets, in the skills section, and in the description, responsibilities and environment of every role the plan lists for it. Spread them naturally: never more than twice in one bullet, never as a bare keyword list inside a sentence.
- REQUIRED and PREFERRED keywords with direct evidence: use each at least 2–4 times, in the summary or skills and in the roles the plan lists.
- Keywords with transferable evidence: use the JD's exact wording in the skills section and the summary, and describe the related work honestly in the listed roles (for example "MES integration similar to …"). Do not claim years of hands-on use you can't support.
- Keywords with no evidence: do not claim them as experience. Leave them out of responsibilities and environment lines.
- Use the JD's exact spelling and casing for every keyword.`;

/** First pass: read the JD and the resume like a recruiter before anything is written */
const PLAN_SYSTEM = `You are a senior US IT staffing recruiter and resume editor. Analyse a job description against a consultant's resume before the resume is rewritten.

Return ONLY valid JSON:
{
  "roles": [{ "client": string, "role": string, "duration": string, "domain": string }],
  "keywords": [{
    "term": string,
    "priority": "main" | "required" | "preferred",
    "evidence": "direct" | "transferable" | "none",
    "roles": string[],
    "note": string
  }]
}

Rules:
- roles: every client / employer in the resume, most recent first, with its business domain.
- keywords: 20–40 skills, tools, platforms, methodologies, regulations and certifications from the JD, each written exactly as the JD writes it (short terms like "PAS-X", "MES", "GMP", "ISA-95", not sentences).
- priority "main": the 3–6 core skills the role is about (the ones in the job title, repeated in the JD, or listed first as must-haves). "required": other must-haves. "preferred": nice-to-haves.
- evidence "direct": the resume clearly shows the consultant used it (same tool or an obvious alias, e.g. "Werum PAS-X" for "PAS-X"). "transferable": the resume shows closely related work (a similar tool, the same process area). "none": nothing in the resume supports it.
- roles: the clients from the roles list where the consultant used it or related work (empty for "none").
- note: a few words on the evidence.`;

interface PlannedKeyword {
  term: string;
  priority: KeywordPriority;
  evidence: "direct" | "transferable" | "none";
  roles: string[];
  note: string;
}

function normalizePlan(raw: Record<string, unknown>): PlannedKeyword[] {
  const list = Array.isArray(raw.keywords) ? raw.keywords : [];
  const seen = new Set<string>();
  const out: PlannedKeyword[] = [];
  for (const k of list as Record<string, unknown>[]) {
    const term = typeof k?.term === "string" ? k.term.trim() : "";
    if (term.length < 2 || term.length > 60 || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push({
      term,
      priority: k.priority === "main" || k.priority === "preferred" ? k.priority : "required",
      evidence: k.evidence === "direct" || k.evidence === "none" ? k.evidence : "transferable",
      roles: asStrings(k.roles),
      note: typeof k.note === "string" ? k.note.trim().slice(0, 200) : "",
    });
  }
  return out.slice(0, 40);
}

/** How many times each kind of keyword should appear */
const target = (k: PlannedKeyword) =>
  k.evidence === "none" ? 0 : k.priority === "main" && k.evidence === "direct" ? 10 : k.evidence === "direct" ? 2 : 1;

function planBrief(plan: PlannedKeyword[]) {
  const line = (k: PlannedKeyword) => {
    const goal = target(k);
    const want = goal >= 10 ? "use 10–15 times" : goal === 2 ? "use 2–4 times" : goal === 1 ? "use 1–3 times (exact JD wording, honest framing)" : "do NOT claim";
    return `- ${k.term} | ${k.priority.toUpperCase()} | evidence: ${k.evidence}${k.roles.length ? ` | roles: ${k.roles.join("; ")}` : ""} | ${want}${k.note ? ` | ${k.note}` : ""}`;
  };
  return `KEYWORD PLAN:\n${plan.map(line).join("\n")}`;
}

/** What the draft still lacks against the plan; empty when it's on target */
function coverageGaps(text: string, plan: PlannedKeyword[]) {
  const gaps: string[] = [];
  for (const k of plan) {
    const goal = target(k);
    if (!goal) continue;
    const n = countTerm(text, k.term);
    if (goal >= 10 && n < 10) gaps.push(`"${k.term}" appears ${n} times; MAIN skill with direct evidence, raise it to 10–15 (roles: ${k.roles.join("; ") || "where used"})`);
    else if (goal >= 10 && n > 18) gaps.push(`"${k.term}" appears ${n} times; reduce it to at most 15 so it reads naturally`);
    else if (goal < 10 && n < goal) gaps.push(`"${k.term}" is missing; ${k.evidence} evidence, add it with the JD's exact wording (roles: ${k.roles.join("; ") || "summary / skills"})`);
  }
  return gaps;
}

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
    prisma.student.findUnique({ where: { id: consultantId }, select: { firstName: true, lastName: true, resumeFile: true, resumeFileName: true } }),
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

  const inputs = `JOB DESCRIPTION (${role}${jd.clientName ? `, client ${jd.clientName}` : ""}):\n${jd.text.slice(0, MAX_JD_CHARS)}\n\nORIGINAL RESUME OF ${name}:\n${original.slice(0, MAX_RESUME_CHARS)}`;

  // 1. Analyse: the JD's keywords by priority, and the evidence for each in this resume, role by role
  let plan: PlannedKeyword[] = [];
  try {
    plan = normalizePlan(await aiJson<Record<string, unknown>>(ai, { system: PLAN_SYSTEM, user: inputs, maxTokens: 6000, timeoutMs: 150_000 }));
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.warn("[resumes] keyword plan failed, writing without it:", err.message);
  }

  // 2. Write the full resume to the plan
  const write = (user: string) => aiJson<Record<string, unknown>>(ai, { system: SYSTEM, user, maxTokens: 16_000, timeoutMs: 300_000 });
  const brief = plan.length ? `\n\n${planBrief(plan)}` : "";
  let content = normalize(await write(inputs + brief), name);
  if (content.experience.length === 0 && content.summary.length === 0) throw new AiError("The AI returned an empty resume. Please try again.");

  // 3. Check keyword coverage against the plan; one targeted revision when it's short
  const gaps = plan.length ? coverageGaps(resumeContentText(content), plan) : [];
  if (gaps.length) {
    try {
      const revised = normalize(
        await write(
          `${inputs}${brief}\n\nYOUR PREVIOUS DRAFT (JSON):\n${JSON.stringify(content)}\n\nREVISE THE DRAFT. Keep everything that is already right and every role. Fix these keyword gaps by working the terms into the summary, skills, project descriptions, responsibilities and environment lines of the roles listed, written naturally and only where the plan says the consultant has the evidence:\n${gaps.map((g) => `- ${g}`).join("\n")}\n\nReturn the complete revised resume JSON.`,
        ),
        name,
      );
      const better = (c: typeof content) => atsScore(resumeContentText(c), plan).score;
      if (revised.experience.length >= content.experience.length && better(revised) >= better(content)) content = revised;
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      console.warn("[resumes] keyword revision failed, keeping the first draft:", err.message);
    }
  }

  // 4. Score both resumes on the same weighted keyword list
  const keywords = plan.length
    ? plan
    : (content.jdKeywords.length ? content.jdKeywords : content.skills.flatMap((s) => s.items).slice(0, 30));
  const before = atsScore(original, keywords);
  const after = atsScore(resumeContentText(content), keywords);

  const docx = await buildResumeDocx(content);
  const file = await saveResume(docx, "docx", "tailored");
  // Same name as the consultant's uploaded resume (always saved as Word)
  const base = (consultant.resumeFileName ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").trim() || name || "Resume";

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
      fileName: `${base}.docx`,
      atsBefore: before.score,
      atsAfter: after.score,
      keywords: {
        matched: after.matched,
        missing: after.missing,
        plan: plan.map(({ term, priority, evidence, note }) => ({ term, priority, evidence, note })),
      },
      provider: ai.label,
      model: ai.model,
    },
  });
}
