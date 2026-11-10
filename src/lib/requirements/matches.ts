import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { MARKETING_STATUSES, onTechnology, techStem } from "@/lib/easy/data";
import { consultantScope } from "@/lib/resumes/data";
import { RESUME_TYPES, extOf, readResume } from "@/lib/files/resumes";
import { resumeName } from "@/lib/files/resume-name";
import { sendVendorEmail } from "@/lib/email";
import { sendMail } from "@/lib/gmail/compose";
import { GmailNotConnectedError, isGmailConfigured } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import type { VendorMatch } from "@/lib/vendors/matches";
import { audienceFor, canSee, marketedConsultants } from "./audience";

export class RequirementError extends Error {}

/** The requirement, when this user may see it (managers: any; recruiters: their consultants' technologies) */
export async function requirementFor(session: SessionPayload, id: string) {
  const req = await prisma.emailRequirement.findUnique({ where: { id } });
  if (!req) return null;
  if (isManager(session)) return req;
  return canSee(audienceFor(req.technology, await marketedConsultants()), session.userId) ? req : null;
}

/** The user's own In-Market consultants (managers: everyone's) on the requirement's technology */
export async function matchedForRequirement(session: SessionPayload, id: string): Promise<{ consultants: VendorMatch[]; technologies: string[] } | null> {
  const req = await requirementFor(session, id);
  if (!req) return null;
  const tech = req.technology?.trim();
  if (!tech || tech.toLowerCase() === "others") return { consultants: [], technologies: [] };
  const stem = techStem(tech);

  const students = await prisma.student.findMany({
    where: { ...consultantScope(session), projectStatus: { in: MARKETING_STATUSES }, technology: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, technology: true, projectStatus: true, visaStatus: true, city: true, state: true, resumeFile: true,
      preMarketings: { select: { marketingVisaStatus: true, recruiter: { select: { firstName: true, lastName: true } } }, take: 1 },
      tailoredResumes: { where: { emailRequirementId: id }, orderBy: { createdAt: "desc" }, take: 1 },
      requirementSends: { where: { requirementId: id, status: "sent" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return {
    technologies: [tech],
    consultants: students
      .filter((s) => s.technology!.trim().toLowerCase() === tech.toLowerCase() || onTechnology(s.technology, stem))
      .map((s) => {
        const t = s.tailoredResumes[0];
        const kw = (t?.keywords ?? {}) as { missing?: string[] };
        const r = s.preMarketings[0]?.recruiter;
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          technology: s.technology,
          status: s.projectStatus,
          visa: s.preMarketings[0]?.marketingVisaStatus ?? s.visaStatus,
          location: [s.city, s.state].filter(Boolean).join(", ") || null,
          recruiterName: r ? `${r.firstName} ${r.lastName}`.trim() : null,
          resume: s.resumeFile ? { file: s.resumeFile, name: resumeName(s, extOf(s.resumeFile)) } : null,
          tailored: t
            ? { id: t.id, file: t.file, name: resumeName(s, extOf(t.file)), atsBefore: t.atsBefore, atsAfter: t.atsAfter, missing: kw.missing ?? [], createdAt: t.createdAt.toISOString() }
            : null,
          sentCount: s.requirementSends.length,
          lastSentAt: s.requirementSends[0]?.createdAt.toISOString() ?? null,
        };
      }),
  };
}

/** The requirement's JD for the AI, checking the consultant is the user's to submit */
export async function tailorInputFor(session: SessionPayload, id: string, consultantId: string) {
  const req = await requirementFor(session, id);
  if (!req) throw new RequirementError("Requirement not found");
  const mine = await prisma.student.findFirst({ where: { id: consultantId, ...consultantScope(session) }, select: { id: true } });
  if (!mine) throw new RequirementError("Consultant not found");
  return {
    consultantId,
    userId: session.userId,
    emailRequirementId: id,
    jd: { text: req.jobDescription, jobTitle: req.jobTitle, technology: req.technology, clientName: req.clientName },
  };
}

/** {firstName}, {vendorName}/{name} and {company} are filled in for the vendor */
const personalize = (text: string, v: { name: string; company: string }) =>
  text
    .replace(/\{firstName\}/g, v.name.trim().split(/\s+/)[0] || "there")
    .replace(/\{(vendorName|name)\}/g, v.name.trim() || "there")
    .replace(/\{company\}/g, v.company.trim() || "your team");

/**
 * Emails the consultant's resume, updated for this requirement's JD, to the requirement's vendor,
 * named "First_Last_Resume.docx". From the sender's Gmail when connected, else the company mailbox.
 */
export async function sendForRequirement(session: SessionPayload, id: string, input: { consultantId: string; subject: string; body: string }) {
  const req = await requirementFor(session, id);
  if (!req) throw new RequirementError("Requirement not found");
  const to = (req.vendorEmail ?? req.fromEmail).trim();
  if (!/\S+@\S+\.\S+/.test(to)) throw new RequirementError("This requirement has no vendor email");

  const [consultant, sender] = await Promise.all([
    prisma.student.findFirst({
      where: { id: input.consultantId, ...consultantScope(session) },
      select: { firstName: true, lastName: true, tailoredResumes: { where: { emailRequirementId: id }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true, email: true } }),
  ]);
  if (!consultant) throw new RequirementError("Consultant not found");
  if (!sender) throw new RequirementError("Unauthorized");
  const tailored = consultant.tailoredResumes[0];
  if (!tailored) throw new RequirementError("Update the resume for this job description first, then send it.");

  const attachment = {
    filename: resumeName(consultant, extOf(tailored.file)),
    content: await readResume(tailored.file),
    contentType: RESUME_TYPES[extOf(tailored.file)] ?? "application/octet-stream",
  };
  const vendor = { name: req.vendorName ?? "", company: req.vendorCompany ?? "" };
  const message = { to, subject: personalize(input.subject, vendor), body: personalize(input.body, vendor) };
  const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.email;

  let via =
    (await isGmailConfigured()) && (await prisma.gmailAccount.findFirst({ where: { userId: session.userId, lastError: null }, select: { id: true } }))
      ? "gmail"
      : "smtp";
  let error: string | null = null;
  try {
    if (via === "gmail") {
      try {
        await sendMail(session.userId, { ...message, files: [attachment] });
      } catch (err) {
        if (!(err instanceof GmailNotConnectedError)) throw err;
        via = "smtp";
      }
    }
    if (via === "smtp") await sendVendorEmail({ ...message, senderName, replyTo: sender.email, attachments: [attachment] });
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Send failed";
    console.error(`[requirement-send] ${to}:`, error);
  }

  await prisma.emailRequirementSend.create({
    data: {
      requirementId: id, consultantId: input.consultantId, senderId: session.userId, tailoredResumeId: tailored.id,
      toEmail: to, subject: message.subject.slice(0, 300), via, status: error ? "failed" : "sent", error,
    },
  });
  if (error) throw new RequirementError(`Could not send: ${error}`);
  if (via === "gmail") void syncEmailStats(session.userId).catch(() => {});
  return { attached: attachment.filename, to };
}
