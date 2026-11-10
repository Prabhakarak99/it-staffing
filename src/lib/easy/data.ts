import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { addDays, todayKey } from "@/lib/attendance/dates";
import { dayStart } from "@/lib/tz";

export const EASY_SCREEN = { name: "Easy Submissions", path: "/admin/easy-submissions" };

/** Consultants still being marketed */
export const MARKETING_STATUSES = ["In-Market", "Project Completed- InMarket"];
const RECENT_SUBMISSION_MS = 60 * 86_400_000;

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** Start and end of a Central calendar day as instants */
export function dayRange(key = todayKey()) {
  return { start: dayStart(key), end: dayStart(addDays(key, 1)) };
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

/** Today's submissions (Central date): the recruiter's own, or everyone's for managers */
export async function todaysSubmissions(session: SessionPayload): Promise<EasySubmissionRow[]> {
  const { start, end } = dayRange();
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

/**
 * Short names (MES, DE, BA, QA, SAP) must match as a whole word, or "MES" would match "Mainframes"
 * and "DE" would match "Devops". Longer stems match anywhere ("mainframe" in "Mainframe Developer").
 */
type TextFilter = { equals?: string; contains?: string; startsWith?: string; endsWith?: string; mode: "insensitive" };

function techFilters(stem: string): TextFilter[] {
  const ci = "insensitive" as const;
  if (stem.length > 3) return [{ contains: stem, mode: ci }];
  const seps = [" ", "/", "-", ","];
  return [
    { equals: stem, mode: ci },
    { contains: `(${stem})`, mode: ci },
    ...seps.flatMap((sep) => [
      { startsWith: `${stem}${sep}`, mode: ci },
      { endsWith: `${sep}${stem}`, mode: ci },
      ...seps.map((after) => ({ contains: `${sep}${stem}${after}`, mode: ci })),
    ]),
  ];
}

/** Rows whose `field` is on the technology */
const techWhere = <F extends string>(field: F, stem: string) => ({ OR: techFilters(stem).map((f) => ({ [field]: f }) as Record<F, TextFilter>) });

/** Same rule in code, for values already loaded */
export function onTechnology(value: string | null | undefined, stem: string) {
  if (!value) return false;
  if (stem.length > 3) return value.toLowerCase().includes(stem.toLowerCase());
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(value);
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
}

/**
 * Other In-Market consultants whose profile technology matches the submitted consultant's profile
 * technology. The submission's own technology is never used: when the submitted consultant's
 * profile has no technology, the list is empty (`technology: null`) until the profile is filled in.
 * The submitted consultant is left out.
 */
export async function consultantsFor(submissionId: string): Promise<{ technology: string | null; consultants: ConsultantOption[] } | null> {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, consultantId: true, technology: true, consultant: { select: { technology: true } } },
  });
  if (!sub) return null;
  const technology = sub.consultant.technology?.trim() || null;
  if (!technology) return { technology: null, consultants: [] };
  const stem = techStem(technology);

  const students = await prisma.student.findMany({
    where: {
      id: { not: sub.consultantId },
      AND: [
        {
          // In-Market, or no status set but submitted recently (so clearly being marketed)
          AND: [{
            OR: [
              { projectStatus: { in: MARKETING_STATUSES } },
              { OR: [{ projectStatus: null }, { projectStatus: "" }], submissions: { some: { createdAt: { gte: new Date(Date.now() - RECENT_SUBMISSION_MS) } } } },
            ],
          }],
          OR: [techWhere("technology", stem), { technology: { equals: technology, mode: "insensitive" } }],
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

  const consultants = students.map((s) => {
      const t = s.tailoredResumes[0];
      const keywords = (t?.keywords ?? {}) as { missing?: string[] };
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        technology: s.technology?.trim() || null,
        projectStatus: s.projectStatus,
        visaStatus: s.preMarketings[0]?.marketingVisaStatus ?? s.visaStatus,
        location: [s.city, s.state].filter(Boolean).join(", ") || null,
        recruiterName: fullName(s.preMarketings[0]?.recruiter),
        resume: s.resumeFile ? { file: s.resumeFile, name: s.resumeFileName ?? "Resume" } : null,
        tailored: t
          ? { id: t.id, file: t.file, name: t.fileName, atsBefore: t.atsBefore, atsAfter: t.atsAfter, missing: keywords.missing ?? [], createdAt: t.createdAt.toISOString() }
          : null,
        sentCount: s._count.easySends,
      };
    });
  return { technology, consultants };
}

export interface VendorOption {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  sources: string[];
  /** Technology and date of this vendor's most recent submission in our data */
  lastTechnology: string | null;
  lastSubmittedAt: string | null;
  /** Primary: last submission (or their vendor book / contact entry) is on the requirement's technology */
  primary: boolean;
}

/**
 * Vendors we know for the submission's client / implementation partner, from every recruiter's vendor
 * book, the vendor contact list and past submissions. Vendors this consultant was already submitted to
 * for the same client (or already emailed from here for this requirement) are left out.
 * Primary vendors are the ones whose last submission was on the same technology.
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
        : techWhere("technologies", stem),
      select: { email: true, name: true, companyName: true, phone: true, technologies: true },
    }),
    prisma.vendorContact.findMany({
      where: {
        doNotContact: false,
        ...(client || impl
          ? { OR: [...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])] }
          : techWhere("technology", stem)),
      },
      select: { email: true, recruiterName: true, vendorCompany: true, phone: true, technology: true },
    }),
    client || impl
      ? prisma.submission.findMany({
          where: { OR: [...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])] },
          select: { vendorRecruiterEmail: true, vendorRecruiterName: true, vendorCompany: true, vendorRecruiterPhone: true },
          distinct: ["vendorRecruiterEmail"],
          take: 300,
        })
      : prisma.submission.findMany({
          where: techWhere("technology", stem),
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
  const onTech = (t: string | null | undefined) => onTechnology(t, stem);
  /** Vendors whose vendor book / contact entry lists the technology */
  const listedTech = new Set<string>();

  const add = (email: string | null | undefined, name: string | null, company: string | null, phone: string | null, source: string, tech?: string | null) => {
    const key = email?.trim().toLowerCase();
    if (!key || !/\S+@\S+\.\S+/.test(key)) return;
    if (excluded.has(key)) {
      hidden.add(key);
      return;
    }
    if (onTech(tech)) listedTech.add(key);
    const v = byEmail.get(key) ?? { email: key, name: null, company: null, phone: null, sources: [], lastTechnology: null, lastSubmittedAt: null, primary: false };
    v.name ??= name?.trim() || null;
    v.company ??= company?.trim() || null;
    v.phone ??= phone?.trim() || null;
    if (!v.sources.includes(source)) v.sources.push(source);
    byEmail.set(key, v);
  };

  book.forEach((v) => add(v.email, v.name, v.companyName, v.phone, "Vendor book", v.technologies));
  contacts.forEach((v) => add(v.email, v.recruiterName, v.vendorCompany, v.phone, "Vendor contacts", v.technology));
  past.forEach((v) => add(v.vendorRecruiterEmail, v.vendorRecruiterName, v.vendorCompany, v.vendorRecruiterPhone, "Past submissions"));

  // Each vendor's most recent submission, from any client, decides primary vs secondary
  const emails = [...byEmail.keys()];
  const history = emails.length
    ? await prisma.submission.findMany({
        where: { OR: emails.map((e) => ({ vendorRecruiterEmail: { equals: e, mode: "insensitive" as const } })) },
        select: { vendorRecruiterEmail: true, technology: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  for (const h of history) {
    const v = byEmail.get(h.vendorRecruiterEmail.trim().toLowerCase());
    if (!v || v.lastSubmittedAt) continue; // newest first: keep the first one seen
    v.lastTechnology = h.technology;
    v.lastSubmittedAt = h.createdAt.toISOString();
  }
  for (const v of byEmail.values()) v.primary = onTech(v.lastTechnology) || listedTech.has(v.email);

  const vendors = [...byEmail.values()].sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      (b.lastSubmittedAt ?? "").localeCompare(a.lastSubmittedAt ?? "") ||
      (a.company ?? "").localeCompare(b.company ?? ""),
  );
  return { vendors, hidden: hidden.size, client, implementation: impl };
}
