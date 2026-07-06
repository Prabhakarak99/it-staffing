export const PROJECT_STATUSES = [
  "Pre-Marketing",
  "In-Market",
  "Verbal Confirmation",
  "Confirmation",
  "In-Project",
  "Project Completed- InMarket",
  "ProjectCompleted-Exit",
  "Second Project",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Pre-Marketing": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  "In-Market": { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  "Verbal Confirmation": { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  Confirmation: { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  "In-Project": { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Project Completed- InMarket": { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  "ProjectCompleted-Exit": { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  "Second Project": { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
};
