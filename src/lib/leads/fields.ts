// Lead field options and input parsing. No server imports: the lead form uses the option lists too.

export const LEAD_STATUSES = ["Interested", "Joined", "Premarketing", "Marketing", "Placement", "Not Interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_VISA_STATUSES = ["F1", "Initial OPT", "Stem OPT", "CPT", "H1B", "H4Ead", "GC", "TN", "U", "Citizen"];

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
  "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
];

export const STATUS_STYLES: Record<LeadStatus, string> = {
  Interested: "bg-sky-50 text-sky-700 border-sky-200",
  Joined: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Premarketing: "bg-violet-50 text-violet-700 border-violet-200",
  Marketing: "bg-amber-50 text-amber-700 border-amber-200",
  Placement: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Not Interested": "bg-slate-100 text-slate-500 border-slate-200",
};

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

/** A lead as sent to the browser (dates as ISO strings) */
export interface LeadRow {
  id: string;
  consultantId: string | null;
  consultantName: string;
  phoneNumber: string | null;
  email: string;
  visaStatus: string | null;
  university: string | null;
  state: string | null;
  optStartDate: string | null;
  status: string;
  comments: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Validates a create/update body. Returns the Prisma data or an error message. */
export function parseLeadInput(body: Record<string, unknown>) {
  const consultantName = text(body.consultantName);
  const email = text(body.email);
  if (!consultantName) return { error: "Full name is required" } as const;
  if (!email) return { error: "Email is required" } as const;

  const status = body.status ?? "Interested";
  if (!isLeadStatus(status)) return { error: "Invalid status" } as const;

  let optStartDate: Date | null = null;
  const rawDate = text(body.optStartDate);
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return { error: "Invalid OPT start date" } as const;
    optStartDate = new Date(`${rawDate}T00:00:00.000Z`);
    if (Number.isNaN(optStartDate.getTime())) return { error: "Invalid OPT start date" } as const;
  }

  return {
    data: {
      consultantName,
      email,
      phoneNumber: text(body.phoneNumber),
      visaStatus: text(body.visaStatus),
      university: text(body.university),
      state: text(body.state),
      optStartDate,
      status,
      comments: text(body.comments),
    },
  } as const;
}

/** OPT start dates are stored as UTC midnight; format without shifting the day */
export function fmtOptDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
