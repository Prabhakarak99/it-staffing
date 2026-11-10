/**
 * Personal email templates: categories, fill-in fields and rendering. No server imports, so the
 * compose boxes render templates in the browser and the follow-up sender renders them on the server
 * the same way.
 */

export const EMAIL_TEMPLATES_SCREEN = { name: "Email Templates", path: "/admin/email-templates" };

export const TEMPLATE_CATEGORIES = [
  { id: "submission", label: "Submission email", hint: "Easy Submissions: sending a consultant's resume to vendors" },
  { id: "followup-submission", label: "Submission follow-up", hint: "Follow-ups: a week after a submission" },
  { id: "followup-interview", label: "Interview follow-up", hint: "Follow-ups: the day after an interview" },
  { id: "general", label: "General", hint: "Anything else" },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["id"];

export const isCategory = (v: unknown): v is TemplateCategory => TEMPLATE_CATEGORIES.some((c) => c.id === v);
export const categoryLabel = (id: string) => TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? "General";

export interface EmailTemplateDto {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  isDefault: boolean;
  updatedAt: string;
}

/** Fill-in fields, shown as chips in the template editor */
export const TEMPLATE_FIELDS = [
  { key: "firstName", label: "Vendor first name", group: "Vendor" },
  { key: "vendorName", label: "Vendor full name", group: "Vendor" },
  { key: "company", label: "Vendor company", group: "Vendor" },
  { key: "consultantName", label: "Consultant name", group: "Consultant" },
  { key: "technology", label: "Technology", group: "Consultant" },
  { key: "client", label: "Client", group: "Consultant" },
  { key: "visa", label: "Visa", group: "Consultant" },
  { key: "location", label: "Location", group: "Consultant" },
  { key: "rate", label: "Rate", group: "Consultant" },
  { key: "jobDescription", label: "Job description", group: "Consultant" },
  { key: "date", label: "Submission / interview date", group: "Follow-up" },
  { key: "interviewLevel", label: "Interview round", group: "Follow-up" },
  { key: "myName", label: "My name", group: "Me" },
  { key: "myEmail", label: "My email", group: "Me" },
  { key: "signature", label: "My signature", group: "Me" },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_FIELDS)[number]["key"], string | null | undefined>>;

/**
 * Replaces {field} with its value. Fields not given in `vars` are left as they are (Easy Submissions
 * fills {firstName} / {company} per vendor when sending); fields given as empty disappear.
 */
export function fillFields(text: string, vars: TemplateVars) {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? (vars[key as keyof TemplateVars] ?? "").trim() : whole));
}

/** Body with the signature: at {signature} when the template has it, otherwise at the end */
export function renderBody(body: string, vars: TemplateVars) {
  const signature = vars.signature?.trim() ?? "";
  const withSig = /\{signature\}/.test(body) || !signature ? body : `${body.replace(/\s+$/, "")}\n\n${signature}`;
  return fillFields(withSig, { ...vars, signature })
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sign-off for the built-in drafts: the signature when set, otherwise "Thanks & Regards, Name" */
export const signOff = (signature: string | null | undefined, name: string, email?: string) =>
  signature?.trim() || ["Thanks & Regards,", name, ...(email ? [email] : [])].join("\n");

/** Pre-selected template for a category: the one marked default */
export const defaultTemplate = (templates: EmailTemplateDto[], category: TemplateCategory) =>
  templates.find((t) => t.category === category && t.isDefault) ?? null;
