// No server imports: the Vendor Requirements page and the notifier use these too.

export const VENDOR_REQ_SCREEN = { name: "Vendor Requirements", path: "/admin/vendor-requirements" };

/** The technologies consultants are filed under (same list as the consultant form) */
export const REQ_TECHNOLOGIES = [
  ".Net", "Java", "DE", "DS/GenAi/ML", "Devops", "Mainframes", "MES", "Networking", "BA", "Sales Force", "SAP",
  "ServiceNow", "Manufacturing", "Cyber Security", "QA", "Oracle", "Dynamics 365", "SCM", "CSV", "Others",
];

/** Who can see a requirement */
export type Audience =
  /** The inbox owner has a consultant on this technology: only they see it */
  | { kind: "private"; userIds: string[] }
  /** Sent to the recruiters who work In-Market consultants on this technology */
  | { kind: "shared"; userIds: string[] }
  /** Nobody works this technology: only managers see it */
  | { kind: "unassigned" };

export interface RequirementRow {
  id: string;
  receivedAt: string;
  createdAt: string;
  subject: string;
  jobTitle: string | null;
  technology: string | null;
  clientName: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  rate: string | null;
  duration: string | null;
  visa: string | null;
  jobDescription: string;
  vendorName: string | null;
  vendorCompany: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  fromEmail: string;
  /** Whose inbox it came from (managers only; recruiters never see where a requirement came from) */
  source: { id: string; name: string; email: string | null; /** Read from this consultant's Gmail (else the recruiter's own) */ consultant: string | null } | null;
  alsoReceivedBy: string[];
  audience: { kind: Audience["kind"]; names: string[] };
  /** The viewer's own In-Market consultants on this technology */
  myConsultants: string[];
  mine: boolean;
}
