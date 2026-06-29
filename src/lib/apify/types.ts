export interface ScrapedJob {
  jobId: string;
  source: "LinkedIn" | "Indeed" | "Google";
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
}
