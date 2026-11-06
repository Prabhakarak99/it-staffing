import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { addDays, todayKey } from "@/lib/attendance/dates";

export const EASY_SCREEN = { name: "Easy Submissions", path: "/admin/easy-submissions" };

/** Consultants still being marketed */
export const MARKETING_STATUSES = ["In-Market", "Project Completed- InMarket"];

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** Start and end of an India calendar day as instants */
export function istDay(key = todayKey()) {
  return { start: new Date(`${key}T00:00:00+05:30`), end: new Date(`${addDays(key, 1)}T00:00:00+05:30`) };
}

export interface EasySubmissionRow {
  id: string;
  submissionId: string;
  submittedAt: string;
  recruiterName: string | null;
  consultantId: string;
  consultantName: string;
  technology: string;
  clientName: string | null;
  implementationName: string | null;
  vendorCompany: string;
  vendorRecruiterName: string;
  status: string;
  hasJobDescription: boolean;
}

/** Today's submissions (India date): the recruiter's own, or everyone's for managers */
export async function todaysSubmissions(session: SessionPayload): Promise<EasySubmissionRow[]> {
  const { start, end } = istDay();
  const rows = await prisma.submission.findMany({
    where: {
      OR: [{ submissionDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
      ...(isManager(session) ? {} : { recruiterId: session.userId }),
    },
    include: {
      consultant: { select: { firstName: true, lastName: true } },
      recruiter: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    submissionId: s.submissionId,
    submittedAt: s.createdAt.toISOString(),
    recruiterName: fullName(s.recruiter),
    consultantId: s.consultantId,
    consultantName: fullName(s.consultant) ?? "",
    technology: s.technology,
    clientName: s.clientName,
    implementationName: s.implementationName,
    vendorCompany: s.vendorCompany,
    vendorRecruiterName: s.vendorRecruiterName,
    status: s.status,
    hasJobDescription: !!s.jobDescription?.trim(),
  }));
}

/** "Mainframes" / "Mainframe Developer" → "mainframe": the first word without a plural s */
export function techStem(technology: string) {
  const first = technology.trim().split(/[\s/,|()-]+/).find(Boolean) ?? technology.trim();
  return first.length > 3 ? first.replace(/s$/i, "") : first;
}

export interface ConsultantOption {
  id: string;
  name: string;
  technology: string | null;
  projectStatus: string | null;
  visaStatus: string | null;
  location: string | null;
  recruiterName: string | null;
  resume: { file: string; name: string } | null;
  tailored: { id: string; file: string; name: string; atsBefore: number; atsAfter: number; missing: string[]; createdAt: string } | null;
  sentCount: number;
  isOriginal: boolean;
}

/** In-Market consultants on the submission's technology, plus the submitted consultant */
export async function consultantsFor(submissionId: string): Promise<ConsultantOption[] | null> {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { id: true, consultantId: true, technology: true } });
  if (!sub) return null;
  const stem = techStem(sub.technology);

  const students = await prisma.student.findMany({
    where: {
      OR: [
        { id: sub.consultantId },
        {
          projectStatus: { in: MARKETING_STATUSES },
          OR: [{ technology: { contains: stem, mode: "insensitive" } }, { technology: { equals: sub.technology, mode: "insensitive" } }],
        },
      ],
    },
    include: {
      preMarketings: { include: { recruiter: { select: { firstName: true, lastName: true } } }, take: 1 },
      tailoredResumes: { where: { submissionId }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { easySends: { where: { submissionId, status: "sent" } } } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return students
    .map((s) => {
      const t = s.tailoredResumes[0];
      const keywords = (t?.keywords ?? {}) as { missing?: string[] };
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        technology: s.technology,
        projectStatus: s.projectStatus,
        visaStatus: s.preMarketings[0]?.marketingVisaStatus ?? s.visaStatus,
        location: [s.city, s.state].filter(Boolean).join(", ") || null,
        recruiterName: fullName(s.preMarketings[0]?.recruiter),
        resume: s.resumeFile ? { file: s.resumeFile, name: s.resumeFileName ?? "Resume" } : null,
        tailored: t
          ? { id: t.id, file: t.file, name: t.fileName, atsBefore: t.atsBefore, atsAfter: t.atsAfter, missing: keywords.missing ?? [], createdAt: t.createdAt.toISOString() }
          : null,
        sentCount: s._count.easySends,
        isOriginal: s.id === sub.consultantId,
      };
    })
    .sort((a, b) => Number(b.isOriginal) - Number(a.isOriginal));
}

export interface VendorOption {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  sources: string[];
}

/**
 * Vendors we know for the submission's client / implementation partner, from every recruiter's vendor
 * book, the vendor contact list and past submissions. Vendors this consultant was already submitted to
 * for the same client (or already emailed from here for this requirement) are left out.
 */
export async function vendorsFor(submissionId: string, consultantId: string) {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return null;

  const client = sub.clientName?.trim() || null;
  const impl = sub.implementationName?.trim() || null;
  const like = (v: string) => ({ contains: v, mode: "insensitive" as const });
  const stem = techStem(sub.technology);

  const [book, contacts, past, alreadySubmitted, alreadySent] = await Promise.all([
    prisma.recruiterVendor.findMany({
      where: client || impl
        ? { OR: [...(client ? [{ clients: like(client) }, { implementationPartners: like(client) }] : []), ...(impl ? [{ implementationPartners: like(impl) }, { clients: like(impl) }] : [])] }
        : { technologies: like(stem) },
      select: { email: true, name: true, companyName: true, phone: true },
    }),
    prisma.vendorContact.findMany({
      where: {
        doNotContact: false,
        ...(client || impl
          ? { OR: [...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])] }
          : { technology: like(stem) }),
      },
      select: { email: true, recruiterName: true, vendorCompany: true, phone: true },
    }),
    client || impl
      ? prisma.submission.findMany({
          where: { OR: [...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])] },
          select: { vendorRecruiterEmail: true, vendorRecruiterName: true, vendorCompany: true, vendorRecruiterPhone: true },
          distinct: ["vendorRecruiterEmail"],
          take: 300,
        })
      : prisma.submission.findMany({
          where: { technology: like(stem) },
          select: { vendorRecruiterEmail: true, vendorRecruiterName: true, vendorCompany: true, vendorRecruiterPhone: true },
          distinct: ["vendorRecruiterEmail"],
          take: 300,
        }),
    prisma.submission.findMany({
      where: {
        consultantId,
        OR: [{ id: sub.id }, ...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])],
      },
      select: { vendorRecruiterEmail: true },
    }),
    prisma.easySubmissionSend.findMany({ where: { consultantId, submissionId: sub.id, status: "sent" }, select: { vendorEmail: true } }),
  ]);

  const excluded = new Set([...alreadySubmitted.map((s) => s.vendorRecruiterEmail), ...alreadySent.map((s) => s.vendorEmail)].map((e) => e.trim().toLowerCase()));
  const byEmail = new Map<string, VendorOption>();
  const hidden = new Set<string>();

  const add = (email: string | null | undefined, name: string | null, company: string | null, phone: string | null, source: string) => {
    const key = email?.trim().toLowerCase();
    if (!key || !/\S+@\S+\.\S+/.test(key)) return;
    if (excluded.has(key)) {
      hidden.add(key);
      return;
    }
    const v = byEmail.get(key) ?? { email: key, name: null, company: null, phone: null, sources: [] };
    v.name ??= name?.trim() || null;
    v.company ??= company?.trim() || null;
    v.phone ??= phone?.trim() || null;
    if (!v.sources.includes(source)) v.sources.push(source);
    byEmail.set(key, v);
  };

  book.forEach((v) => add(v.email, v.name, v.companyName, v.phone, "Vendor book"));
  contacts.forEach((v) => add(v.email, v.recruiterName, v.vendorCompany, v.phone, "Vendor contacts"));
  past.forEach((v) => add(v.vendorRecruiterEmail, v.vendorRecruiterName, v.vendorCompany, v.vendorRecruiterPhone, "Past submissions"));

  const vendors = [...byEmail.values()].sort((a, b) => b.sources.length - a.sources.length || (a.company ?? "").localeCompare(b.company ?? ""));
  return { vendors, hidden: hidden.size, client, implementation: impl };
}
