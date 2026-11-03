const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const optional = (v: unknown) => text(v) || null;

export interface VendorInput {
  name: string;
  email: string;
  phone: string | null;
  companyName: string;
  technologies: string | null;
  clients: string | null;
  implementationPartners: string | null;
  notes: string | null;
}

/** Validates a create/edit body. Returns the cleaned fields or an error message. */
export function parseVendorInput(body: Record<string, unknown>): VendorInput | string {
  const input: VendorInput = {
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    phone: optional(body.phone),
    companyName: text(body.companyName),
    technologies: optional(body.technologies),
    clients: optional(body.clients),
    implementationPartners: optional(body.implementationPartners),
    notes: optional(body.notes),
  };
  if (!input.name) return "Name is required";
  if (!input.companyName) return "Company name is required";
  if (!EMAIL_RE.test(input.email)) return "A valid email is required";
  return input;
}
