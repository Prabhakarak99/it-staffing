const TECHNOLOGIES = [
  "SAP", "S/4HANA", "S4HANA", "ABAP", "MES", "PLM", "Teamcenter", "Windchill",
  "Opcenter", "Siemens", "Oracle", "Salesforce", "ServiceNow", "Workday",
  "Veeva", "Java", "Python", "React", "Angular", "Vue", "TypeScript",
  "JavaScript", "Node.js", ".NET", "C#", "Azure", "AWS", "GCP", "DevOps",
  "Kubernetes", "Docker", "Terraform", "Ansible", "Jenkins", "Kafka",
  "Spark", "Databricks", "Snowflake", "Tableau", "Power BI", "SQL",
  "Linux", "Pharma IT", "OT Security",
];

const C2C_KEYWORDS = [
  "c2c", "corp to corp", "corp2corp", "w2/c2c", "c2c/w2", "open to c2c",
  "c2c rate", "c2c only", "corp-to-corp",
];

export function extractTechnologies(text: string): string[] {
  const lower = text.toLowerCase();
  return TECHNOLOGIES.filter((t) => lower.includes(t.toLowerCase()));
}

export function extractPrimaryTechnology(text: string): string | null {
  const priority = ["SAP", "MES", "PLM", "Oracle", "Salesforce", "Teamcenter", "Windchill", "Opcenter", "Veeva", "ServiceNow", "Workday", "Azure", "AWS", "Java", "Python"];
  const lower = text.toLowerCase();
  return priority.find((t) => lower.includes(t.toLowerCase())) ?? extractTechnologies(text)[0] ?? null;
}

export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match?.[0] ?? null;
}

export function extractPhone(text: string): string | null {
  const match = text.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  return match?.[0]?.trim() ?? null;
}

export function extractRate(text: string): { min: number | null; max: number | null } {
  const rangeMatch = text.match(/\$(\d+)\s*[-–]\s*\$?(\d+)\s*\/?\s*hr/i);
  if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };

  const minMatch = text.match(/\$(\d+)\s*[-–]/);
  const maxMatch = text.match(/[-–]\s*\$?(\d+)\s*\/?\s*hr/i);
  if (minMatch && maxMatch) return { min: parseInt(minMatch[1]), max: parseInt(maxMatch[1]) };

  const singleMatch = text.match(/\$(\d+)\s*\/?\s*hr/i);
  if (singleMatch) return { min: parseInt(singleMatch[1]), max: null };

  return { min: null, max: null };
}

export function extractVisaRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  const visas: string[] = [];
  if (/green card|\bgc\b/.test(lower)) visas.push("GC");
  if (/us citizen|u\.s\. citizen|\busc\b/.test(lower)) visas.push("USC");
  if (/h1b|h-1b|h1-b/.test(lower)) visas.push("H1B");
  if (/tn visa|tn holder/.test(lower)) visas.push("TN");
  if (/\bopt\b|\bcpt\b/.test(lower)) visas.push("OPT/CPT");
  return visas;
}

export function detectJobType(text: string): string {
  const lower = text.toLowerCase();
  const isC2C = C2C_KEYWORDS.some((kw) => lower.includes(kw));
  const isW2 = /\bw-?2\b/.test(lower);
  const is1099 = /\b1099\b/.test(lower);
  if (isC2C && isW2) return "C2C/W2";
  if (isC2C) return "C2C";
  if (isW2) return "W2";
  if (is1099) return "1099";
  return "Contract";
}

export function isC2CJob(text: string): boolean {
  const lower = text.toLowerCase();
  return C2C_KEYWORDS.some((kw) => lower.includes(kw));
}

export function detectRemote(text: string, location?: string | null): boolean {
  return /remote|work from home|\bwfh\b/i.test(`${text} ${location ?? ""}`);
}

export function extractClientName(text: string): string | null {
  const patterns = [
    /(?:end client|direct client|final client|client is|client:)\s*[:-]?\s*([A-Z][A-Za-z0-9\s&.,]+?)(?:\.|,|\n|$)/,
    /(?:for our client|on behalf of)\s+([A-Z][A-Za-z0-9\s&.,]+?)(?:\.|,|\n|$)/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]?.trim()) return m[1].trim().slice(0, 100);
  }
  return null;
}
