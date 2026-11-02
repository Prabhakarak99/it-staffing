import { detectJobType, isC2CJob } from "@/lib/apify/parserService";

// ── Text helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', bull: "•", hellip: "…",
};

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** HTML (possibly entity-escaped, as Greenhouse returns it) → readable plain text */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    decodeEntities(html)
      .replace(/<\s*(br|\/p|\/li|\/h\d|\/div|\/tr)\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Pre-filters (cheap, before any detail fetch or AI call) ─────────────────

const IT_TITLE_RE =
  /\b(software|developer|engineer(ing)?|programmer|architect|devops|devsecops|sre|site reliability|cloud|data|database|dba|etl|analytics|bi|business intelligence|analyst|qa|quality assurance|tester|testing|sdet|automation|java|python|\.net|c#|javascript|typescript|react|angular|node(\.js)?|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|sap|abap|s\/?4 ?hana|salesforce|servicenow|workday|oracle|peoplesoft|dynamics|sharepoint|tableau|power ?bi|snowflake|databricks|spark|kafka|kubernetes|aws|azure|gcp|linux|unix|network|security|cyber|infosec|it|information technology|sys(tems)? ?admin|administrator|help ?desk|desktop support|technical support|scrum|agile|project manager|program manager|product owner|business analyst|ui|ux|machine learning|ml|ai|artificial intelligence|mes|plm|teamcenter|windchill|opcenter|erp|crm|integration|middleware|mulesoft|informatica|mainframe|cobol|veeva|consultant)\b/i;

export function isItTitle(title: string | null | undefined): boolean {
  return !!title && IT_TITLE_RE.test(title);
}

const NON_US_RE =
  /\b(india|canada|united kingdom|england|scotland|ireland|germany|france|spain|portugal|italy|netherlands|belgium|poland|romania|czech|hungary|sweden|norway|denmark|finland|switzerland|austria|mexico|brazil|argentina|colombia|chile|peru|costa rica|philippines|singapore|malaysia|vietnam|thailand|indonesia|japan|china|hong kong|taiwan|korea|australia|new zealand|israel|uae|dubai|egypt|south africa|nigeria|kenya|pakistan|sri lanka|bangladesh|ukraine|turkey|london|toronto|vancouver|montreal|bangalore|bengaluru|hyderabad|chennai|pune|mumbai|noida|gurgaon|gurugram|kolkata|emea|apac|latam|europe)\b/i;
const US_RE = /\b(united states|usa|u\.s\.a?\.?|us|america)\b/i;

/** Keeps US and unknown locations; drops only locations that are clearly outside the US. */
export function isUsLocation(location: string | null | undefined): boolean {
  if (!location || !location.trim()) return true;
  if (US_RE.test(location)) return true;
  return !NON_US_RE.test(location);
}

// ── Rule-based employment-type classification ───────────────────────────────

export interface RuleResult {
  /** Value stored in JobSearchResult.jobType */
  jobType: string;
  employmentType: string;
  isContract: boolean;
  /** "regex" = certain, no AI needed; null = queue for AI */
  classifiedBy: "regex" | null;
}

const EXPLICIT_TYPE_RE = /\b(w-?2|1099)\b/i;
const CONTRACT_HINT_RE = /\b(contract|contractor|contract[- ]to[- ]hire|c2h|temporary|temp|freelance)\b/i;
const WEAK_CONTRACT_RE =
  /\b(contract(or)?|contract[- ]to[- ]hire|c2h|temporary|duration\s*[:\-]|\d+\s*\+?\s*months?\b|hourly rate|per hour|\/\s?hr)\b/i;

/**
 * Decide the employment type from text plus the ATS's own employment field
 * (Lever commitment, Ashby employmentType, Workday timeType, ...).
 * - Explicit C2C / W2 / 1099 in the text → certain.
 * - ATS field or title says contract/temporary → contract, AI refines C2C vs W2.
 * - Only weak hints in the description → "Pending" (hidden until AI decides).
 * - No hints → Full-time.
 */
export function classifyByRules(title: string, description: string, employmentHint?: string | null): RuleResult {
  const text = `${title}\n${description}`;

  if (isC2CJob(text) || EXPLICIT_TYPE_RE.test(text)) {
    const jobType = detectJobType(text);
    return { jobType, employmentType: jobType, isContract: true, classifiedBy: "regex" };
  }

  const hint = (employmentHint ?? "").toLowerCase();
  if (CONTRACT_HINT_RE.test(hint) || CONTRACT_HINT_RE.test(title)) {
    return { jobType: "Contract", employmentType: "Contract", isContract: true, classifiedBy: null };
  }

  if (WEAK_CONTRACT_RE.test(description)) {
    return { jobType: "Pending", employmentType: "Unknown", isContract: false, classifiedBy: null };
  }

  return { jobType: "Full-time", employmentType: "Full-time", isContract: false, classifiedBy: "regex" };
}
