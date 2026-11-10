import { prisma } from "@/lib/prisma";
import { MARKETING_STATUSES, onTechnology, techStem } from "@/lib/easy/data";
import { consultantScope } from "@/lib/resumes/data";
import { RESUME_TYPES, extOf, readResume } from "@/lib/files/resumes";
import { resumeName } from "@/lib/files/resume-name";
import { sendVendorEmail } from "@/lib/email";
import { sendMail } from "@/lib/gmail/compose";
import { GmailNotConnectedError, isGmailConfigured } from "@/lib/gmail/oauth";
import { syncEmailStats } from "@/lib/gmail/stats";
import { ownedWhere, type VendorAccess } from "./access";

type Ok = Extract<VendorAccess, { ok: true }>;

const split = (s: string | null | undefined) => (s ?? "").split(/[,;/|]+/).map((t) => t.trim()).filter(Boolean);
const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** The vendor (if this user may see it) with its JD: typed in, else their latest requirement email's */
export async function vendorWithJd(access: Ok, vendorId: string) {
  const vendor = await prisma.recruiterVendor.findFirst({ where: { id: vendorId, ...ownedWhere(access) } });
  if (!vendor) return null;
  const email = vendor.email.toLowerCase();
  const req = vendor.jobDescription?.trim()
    ? null
    : await prisma.emailRequirement.findFirst({
        where: { OR: [{ vendorEmail: email }, { fromEmail: email }] },
        orderBy: { receivedAt: "desc" },
        select: { jobDescription: true, jobTitle: true, technology: true, clientName: true },
      });
  const jd = vendor.jobDescription?.trim() || req?.jobDescription || null;
  return { vendor, jd, jdTitle: req?.jobTitle ?? null, jdTechnology: req?.technology ?? null, jdClient: req?.clientName ?? null };
}

/**
 * In-Market consultants (the user's own; managers: everyone's) on any of the vendor's technologies, or
 * on the technology of the vendor's latest requirement email, with their AI resume for this vendor.
 */
export async function matchedConsultants(access: Ok, vendorId: string) {
  const found = await vendorWithJd(access, vendorId);
  if (!found) return null;
  const techs = [...new Set([...split(found.vendor.technologies), ...(found.jdTechnology && found.jdTechnology !== "Others" ? [found.jdTechnology] : [])])];
  const stems = techs.map(techStem).filter((s) => s.length >= 2);

  const students = stems.length
    ? await prisma.student.findMany({
        where: { ...consultantScope(access.session), projectStatus: { in: MARKETING_STATUSES }, technology: { not: null } },
        select: {
          id: true, firstName: true, lastName: true, technology: true, projectStatus: true, visaStatus: true, city: true, state: true, resumeFile: true,
          preMarketings: { select: { marketingVisaStatus: true, recruiter: { select: { firstName: true, lastName: true } } }, take: 1 },
          tailoredResumes: { where: { recruiterVendorId: vendorId }, orderBy: { createdAt: "desc" }, take: 1 },
          vendorResumeSends: { where: { vendorId, status: "sent" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
    : [];

  const consultants = students
    .filter((s) => stems.some((stem) => onTechnology(s.technology, stem)))
    .map((s) => {
      const t = s.tailoredResumes[0];
      const kw = (t?.keywords ?? {}) as { missing?: string[] };
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        technology: s.technology,
        status: s.projectStatus,
        visa: s.preMarketings[0]?.marketingVisaStatus ?? s.visaStatus,
        location: [s.city, s.state].filter(Boolean).join(", ") || null,
        recruiterName: fullName(s.preMarketings[0]?.recruiter),
        resume: s.resumeFile ? { file: s.resumeFile, name: resumeName(s, extOf(s.resumeFile)) } : null,
        tailored: t
          ? { id: t.id, file: t.file, name: resumeName(s, extOf(t.file)), atsBefore: t.atsBefore, atsAfter: t.atsAfter, missing: kw.missing ?? [], createdAt: t.createdAt.toISOString() }
          : null,
        sentCount: s.vendorResumeSends.length,
        lastSentAt: s.vendorResumeSends[0]?.createdAt.toISOString() ?? null,
      };
    });

  return { consultants, technologies: techs, hasJd: !!found.jd };
}

export type VendorMatch = NonNullable<Awaited<ReturnType<typeof matchedConsultants>>>["consultants"][number];

/** {firstName}, {vendorName}/{name} and {company} are filled in for the vendor */
const personalize = (text: string, v: { name: string; companyName: string }) =>
  text
    .replace(/\{firstName\}/g, v.name.trim().split(/\s+/)[0] || "there")
    .replace(/\{(vendorName|name)\}/g, v.name.trim() || "there")
    .replace(/\{company\}/g, v.companyName.trim() || "your team");

/**
 * Emails one consultant's resume to the vendor: the AI resume written for this vendor when asked and
 * available, otherwise the uploaded one, always named "First_Last_Resume". From the sender's Gmail when
 * connected, otherwise the company mailbox. Logged, and counted on the vendor.
 */
export async function sendResumeToVendor(access: Ok, vendorId: string, input: { consultantId: string; subject: string; body: string; useTailored: boolean }) {
  const senderId = access.session.userId;
  const [vendor, consultant, sender] = await Promise.all([
    prisma.recruiterVendor.findFirst({ where: { id: vendorId, ...ownedWhere(access) } }),
    prisma.student.findFirst({
      where: { id: input.consultantId, ...consultantScope(access.session) },
      select: { firstName: true, lastName: true, resumeFile: true, tailoredResumes: { where: { recruiterVendorId: vendorId }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, lastName: true, email: true } }),
  ]);
  if (!vendor) throw new Error("Vendor not found");
  if (!consultant) throw new Error("Consultant not found");
  if (!sender) throw new Error("Unauthorized");

  const tailored = input.useTailored ? consultant.tailoredResumes[0] ?? null : null;
  const file = tailored?.file ?? consultant.resumeFile;
  if (!file) throw new Error("This consultant has no resume to attach. Upload one first.");
  const attachment = { filename: resumeName(consultant, extOf(file)), content: await readResume(file), contentType: RESUME_TYPES[extOf(file)] ?? "application/octet-stream" };

  const message = { to: vendor.email, subject: personalize(input.subject, vendor), body: personalize(input.body, vendor) };
  const senderName = `${sender.firstName} ${sender.lastName}`.trim() || sender.email;
  let via = (await isGmailConfigured()) && (await prisma.gmailAccount.findFirst({ where: { userId: senderId, lastError: null }, select: { id: true } })) ? "gmail" : "smtp";
  let error: string | null = null;
  try {
    if (via === "gmail") {
      try {
        await sendMail(senderId, { ...message, files: [attachment] });
      } catch (err) {
        if (!(err instanceof GmailNotConnectedError)) throw err;
        via = "smtp";
      }
    }
    if (via === "smtp") await sendVendorEmail({ ...message, senderName, replyTo: sender.email, attachments: [attachment] });
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Send failed";
    console.error(`[vendor-resume] ${vendor.email}:`, error);
  }

  await prisma.$transaction([
    prisma.vendorResumeSend.create({
      data: { vendorId, consultantId: input.consultantId, senderId, tailoredResumeId: tailored?.id ?? null, subject: message.subject.slice(0, 300), via, status: error ? "failed" : "sent", error },
    }),
    ...(error ? [] : [prisma.recruiterVendor.update({ where: { id: vendorId }, data: { lastEmailedAt: new Date(), emailCount: { increment: 1 } } })]),
  ]);
  if (error) throw new Error(`Could not send: ${error}`);
  if (via === "gmail") void syncEmailStats(senderId).catch(() => {});
  return { attached: attachment.filename, via };
}
