// Paid job-data APIs that can feed the Requirements tab. No server imports: the settings page uses this too.

export const JOB_API_IDS = ["fantastic", "coresignal", "sourcestack", "aspen", "jobfront", "zyte"] as const;
export type JobApiId = (typeof JOB_API_IDS)[number];

export const isJobApiId = (v: unknown): v is JobApiId => typeof v === "string" && (JOB_API_IDS as readonly string[]).includes(v);

export interface JobApiMeta {
  name: string;
  /** One line: what it is */
  about: string;
  /** How a key is obtained */
  access: "self-serve" | "sales";
  accessNote: string;
  pricing: string;
  keyLabel: string;
  keyUrl: string;
  docsUrl: string;
  /** How sure we are of the request/response format (built from the public docs; none could be run without a key) */
  confidence: "documented" | "partly documented" | "unverified";
  /** Zyte reads pages you point it at, instead of searching a jobs database */
  needsStartUrls?: boolean;
  defaultIntervalMin: number;
  /** What "Extra settings" are sent as */
  extraHint: string;
}

export const JOB_APIS: Record<JobApiId, JobApiMeta> = {
  fantastic: {
    name: "Fantastic.jobs",
    about: "Jobs from company career sites (Workday, Greenhouse, Lever and more), refreshed hourly, with contract and US filters.",
    access: "self-serve",
    accessNote: "Sign up on the Fantastic.jobs dashboard and copy the API key.",
    pricing: "$95/month for 20,000 jobs, $175 for 50,000, $250 for 100,000. One credit per job returned.",
    keyLabel: "API key",
    keyUrl: "https://dashboard.fantastic.jobs",
    docsUrl: "https://developer.fantastic.jobs",
    confidence: "documented",
    defaultIntervalMin: 60,
    extraHint: "Query parameters, e.g. ai_visa_sponsorship=only&organization_agency=only",
  },
  coresignal: {
    name: "Coresignal",
    about: "Multi-source jobs database. Searching is free; each job opened costs one credit.",
    access: "self-serve",
    accessNote: "Create a Coresignal account (free trial credits) and copy the API key from the dashboard.",
    pricing: "From $49/month. Search is free, 1 credit per job collected. Free trial: 200 collect credits.",
    keyLabel: "API key",
    keyUrl: "https://dashboard.coresignal.com",
    docsUrl: "https://docs.coresignal.com/jobs-api/multi-source-jobs-api",
    confidence: "partly documented",
    defaultIntervalMin: 120,
    extraHint: "Not used",
  },
  sourcestack: {
    name: "SourceStack",
    about: "Job posts from hundreds of ATS sources, paid per job pulled with no monthly minimum.",
    access: "self-serve",
    accessNote: "Sign up at sourcestack.co (free trial) and copy the API key.",
    pricing: "Pay per job. A third-party review lists credit packs from $249 for 100,000 credits; confirm on their pricing page.",
    keyLabel: "API key",
    keyUrl: "https://sourcestack.co",
    docsUrl: "https://sourcestack.co",
    confidence: "unverified",
    defaultIntervalMin: 180,
    extraHint: "Query parameters added to the /jobs request",
  },
  aspen: {
    name: "Aspen Tech Labs (JobsIndex)",
    about: "IT jobs collected directly from employer career sites. Their self-serve door is an Apify actor.",
    access: "self-serve",
    accessNote: "Uses your Apify account: paste an Apify API token. Bulk feeds are quote-based from Aspen directly.",
    pricing: "From about $1.20 per 1,000 job records through Apify (pay per result).",
    keyLabel: "Apify API token",
    keyUrl: "https://console.apify.com/account/integrations",
    docsUrl: "https://apify.com/aspen-technology-labs-inc/it-jobs-api",
    confidence: "partly documented",
    defaultIntervalMin: 360,
    extraHint: "Actor input fields, e.g. employment_type=Contract&region=Texas",
  },
  jobfront: {
    name: "JobFront",
    about: "Real-time jobs from 400,000+ company career pages, updated every 15 minutes.",
    access: "sales",
    accessNote: "Enterprise only: a JobFront representative issues the first API token (sales@jobfront.com). Then Dashboard > Settings > API.",
    pricing: "Custom enterprise pricing; no public price list.",
    keyLabel: "API token",
    keyUrl: "https://www.jobfront.com/pricing",
    docsUrl: "https://docs.jobfront.com/get-started",
    confidence: "partly documented",
    defaultIntervalMin: 30,
    extraHint: "Query parameters added to /v4/jobs, e.g. is_remote=true",
  },
  zyte: {
    name: "Zyte API",
    about: "Not a jobs database: it reads the job pages you list (career sites, job-board searches) and extracts the postings with AI.",
    access: "self-serve",
    accessNote: "Sign up at zyte.com and copy the Zyte API key. You must list the pages to read below.",
    pricing: "Pay per page read, roughly $0.30 to $1 per 1,000 extractions plus the page cost. Managed feeds start at $450/month.",
    keyLabel: "Zyte API key",
    keyUrl: "https://app.zyte.com/o/zyte-api/api-access",
    docsUrl: "https://docs.zyte.com/zyte-api/usage/extract/index.html",
    confidence: "partly documented",
    needsStartUrls: true,
    defaultIntervalMin: 360,
    extraHint: "Not used",
  },
};

export const DEFAULT_KEYWORDS = ["Java", ".Net", "DevOps", "MES", "SAP", "Data Engineer", "Dynamics 365", "Network Engineer"];

/** One provider's settings and status as the settings page sees it (key only as a masked preview) */
export interface JobApiRow {
  id: JobApiId;
  hasKey: boolean;
  keyPreview: string | null;
  isEnabled: boolean;
  intervalMin: number;
  maxPerRun: number;
  keywords: string[];
  contractOnly: boolean;
  extraParams: string;
  startUrls: string[];
  lastRunAt: string | null;
  lastError: string | null;
  lastFetched: number;
  lastNew: number;
  totalNew: number;
  lastTestedAt: string | null;
  lastTestError: string | null;
}
