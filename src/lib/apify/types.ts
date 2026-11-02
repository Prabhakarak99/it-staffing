export interface ScrapedJob {
  jobId: string;
  /** Display source: LinkedIn | Indeed | Google | Greenhouse | Lever | Ashby | SmartRecruiters | Workday */
  source: string;
  title: string | null;
  vendorName: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  location: string | null;
  isRemote: boolean;
  jobDescription: string | null;
  technology: string | null;
  technologies: string[];
  jobType: string;
  visaRequirements: string[];
  clientName: string | null;
  rateMin: number | null;
  rateMax: number | null;
  applyLink: string | null;
  datePosted: Date | null;
  rawData: Record<string, unknown>;
  // ── Job feed fields (optional so the Apify scrapers don't need to set them) ──
  sourceType?: "ats" | "board" | "email";
  atsProvider?: string | null;
  atsCompanyId?: string | null;
  companyName?: string | null;
  /** C2C | W2 | 1099 | Contract | Full-time | Unknown */
  employmentType?: string | null;
  isContract?: boolean;
  /** "regex" when the rules were certain, null when the job still needs AI */
  classifiedBy?: "regex" | "ai" | null;
}
