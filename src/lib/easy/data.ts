import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { addDays, todayKey } from "@/lib/attendance/dates";
import { dayStart } from "@/lib/tz";
import { extOf } from "@/lib/files/resumes";
import { resumeName } from "@/lib/files/resume-name";

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
      preMarketings: { include: { recruiter: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" }, take: 1 },
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
        resume: s.resumeFile ? { file: s.resumeFile, name: resumeName(s, extOf(s.resumeFile)) } : null,
        tailored: t
          ? { id: t.id, file: t.file, name: resumeName(s, extOf(t.file)), atsBefore: t.atsBefore, atsAfter: t.atsAfter, missing: keywords.missing ?? [], createdAt: t.createdAt.toISOString() }
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

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com", "icloud.com", "msn.com", "protonmail.com", "ymail.com", "rediffmail.com"]);
const COMPANY_NOISE = /\b(inc|llc|ltd|limited|corp|corporation|co|company|pvt|private|plc|technologies|technology|tech|solutions|systems|services|consulting|group|global|usa|us|the)\b/g;

/** "VDart, Inc." / "vdart digital" → "vdart…"; null when nothing distinctive is left */
export function companyKey(name: string | null | undefined) {
  const k = (name ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(COMPANY_NOISE, " ").replace(/\s+/g, "");
  return k.length >= 3 ? k : null;
}

/** Company email domain (free mail like gmail.com doesn't identify a company) */
export function companyDomain(email: string | null | undefined) {
  const d = email?.trim().toLowerCase().split("@")[1];
  return d && !FREE_MAIL.has(d) ? d : null;
}

/** Stable number for a string (FNV-1a), so the vendor split doesn't change between page loads */
function stableHash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Vendors we know for the submission's client / implementation partner, from every recruiter's vendor
 * book, the vendor contact list and past submissions. Every recruiter at the vendor company that already
 * has this requirement (same company name or email domain) is left out. The rest are split evenly
 * between the consultants on this requirement (primary and secondary separately), so each vendor
 * hears about one consultant; then the companies this consultant was already submitted through for
 * the same client, and vendors already emailed from here, are left out of their share.
 * Primary vendors are the ones whose last submission was on the same technology.
 */
export async function vendorsFor(submissionId: string, consultantId: string) {
  return (await vendorShares(submissionId, [consultantId]))?.get(consultantId) ?? null;
}

/** How many vendors each consultant on the requirement has in their share (for the Generate buttons) */
export async function vendorCounts(submissionId: string, team: { id: string }[]) {
  const shares = await vendorShares(submissionId, team.map((c) => c.id), team);
  return Object.fromEntries([...(shares ?? new Map()).entries()].map(([id, r]) => [id, r.vendors.length])) as Record<string, number>;
}

/**
 * The vendor pool for the requirement is built once; then each consultant gets their share of it,
 * without the vendors they already went to. `team` is the requirement's consultant list when known.
 */
async function vendorShares(submissionId: string, consultantIds: string[], knownTeam?: { id: string }[]) {
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
        consultantId: { in: consultantIds },
        OR: [{ id: sub.id }, ...(client ? [{ clientName: like(client) }] : []), ...(impl ? [{ implementationName: like(impl) }] : [])],
      },
      select: { consultantId: true, vendorRecruiterEmail: true, vendorCompany: true },
    }),
    prisma.easySubmissionSend.findMany({
      where: { consultantId: { in: consultantIds }, submissionId: sub.id, status: "sent" },
      select: { consultantId: true, vendorEmail: true },
    }),
  ]);

  /** Matches any recruiter at the vendor companies of these submissions (company name or email domain) */
  const companyMatcher = (subs: { vendorRecruiterEmail: string; vendorCompany: string }[]) => {
    const companies = new Set(subs.map((s) => companyKey(s.vendorCompany)).filter((k): k is string => !!k));
    const domains = new Set(subs.map((s) => companyDomain(s.vendorRecruiterEmail)).filter((d): d is string => !!d));
    return (email: string, company: string | null) => {
      const d = companyDomain(email);
      const k = companyKey(company);
      return (!!d && domains.has(d)) || (!!k && companies.has(k));
    };
  };
  // The vendor company that already has this requirement is left out for everyone...
  const requirementVendor = companyMatcher([{ vendorRecruiterEmail: sub.vendorRecruiterEmail, vendorCompany: sub.vendorCompany }]);

  const byEmail = new Map<string, VendorOption>();
  const hidden = new Set<string>();
  const onTech = (t: string | null | undefined) => onTechnology(t, stem);
  /** Vendors whose vendor book / contact entry lists the technology */
  const listedTech = new Set<string>();

  const add = (email: string | null | undefined, name: string | null, company: string | null, phone: string | null, source: string, tech?: string | null) => {
    const key = email?.trim().toLowerCase();
    if (!key || !/\S+@\S+\.\S+/.test(key)) return;
    if (requirementVendor(key, company)) {
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

  // Split the pool between the consultants on this requirement, primary and secondary separately,
  // so each vendor gets one consultant instead of all of them
  const pool = [...byEmail.values()];
  const team = knownTeam ?? (await consultantsFor(submissionId))?.consultants ?? [];
  const primaryTotal = pool.filter((v) => v.primary).length;
  const order = (list: VendorOption[]) =>
    list
      .map((v) => ({ v, h: stableHash(`${submissionId}|${v.email}`) }))
      .sort((a, b) => a.h - b.h || a.v.email.localeCompare(b.v.email))
      .map((x) => x.v);
  const primaries = order(pool.filter((v) => v.primary));
  const secondaries = order(pool.filter((v) => !v.primary));

  const result = new Map<string, {
    vendors: VendorOption[];
    hidden: number;
    client: string | null;
    implementation: string | null;
    /** This consultant's share of the vendors for the requirement */
    split: { consultants: number; total: number; primaryTotal: number; mine: number } | null;
  }>();
  for (const consultantId of consultantIds) {
    const seat = team.findIndex((c) => c.id === consultantId);
    const split = seat >= 0 && team.length > 1;
    const share = (list: VendorOption[]) => (split ? list.filter((_, i) => i % team.length === seat) : list);
    const mine = [...share(primaries), ...share(secondaries)];

    // Then leave out the ones this consultant already went to: same vendor, or for the same client the same company
    const theirSubs = alreadySubmitted.filter((s) => s.consultantId === consultantId);
    const excluded = new Set(
      [...theirSubs.map((s) => s.vendorRecruiterEmail), ...alreadySent.filter((s) => s.consultantId === consultantId).map((s) => s.vendorEmail)]
        .map((e) => e.trim().toLowerCase()),
    );
    const usedByConsultant = companyMatcher(theirSubs);
    const hiddenHere = new Set(hidden);
    const vendors = mine
      .filter((v) => {
        const used = excluded.has(v.email) || usedByConsultant(v.email, v.company);
        if (used) hiddenHere.add(v.email);
        return !used;
      })
      .sort(
        (a, b) =>
          Number(b.primary) - Number(a.primary) ||
          (b.lastSubmittedAt ?? "").localeCompare(a.lastSubmittedAt ?? "") ||
          (a.company ?? "").localeCompare(b.company ?? ""),
      );
    result.set(consultantId, {
      vendors,
      hidden: hiddenHere.size,
      client,
      implementation: impl,
      split: split ? { consultants: team.length, total: pool.length, primaryTotal, mine: mine.length } : null,
    });
  }
  return result;
}
