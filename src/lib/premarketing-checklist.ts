export const PREMARKETING_CHECKLIST_ITEMS = [
  { key: "addedToApplication", label: "Added to the Application" },
  { key: "offerLetterIssued", label: "Offer Letter Issued" },
  { key: "createdNewEmailPhone", label: "Created new Email and PhoneNumber" },
  { key: "createdDriveLink", label: "Created Drive Link and share to us" },
  { key: "checklistExplanationOverview", label: "CheckList Explanation - general overview" },
  { key: "marketingSheetExplanationByStaff", label: "Marketing Sheet Explanation by staff" },
  { key: "marketingSheetFilledByStudent", label: "Marketing Sheet Filled by student Fully" },
  { key: "technicalQuestionsPreparation", label: "Technical Questions Preparation" },
  { key: "referencesVerified", label: "References (Should verified with all fields)" },
  { key: "explainingEmploymentTypesByStaff", label: "Explaining of W2, C2C, FullTime, C2H and 1099 by Staff" },
  { key: "screeningEmploymentTypesByStudent", label: "Screening of W2, C2C, FullTime, C2H and 1099 by Student" },
  { key: "gatherAllStatesBills", label: "Gather All States Bills" },
  { key: "allJobPortalsCreation", label: "All Job Portals Creation" },
  { key: "explainAllChecklistBrief", label: "Explan all checkList brief" },
  { key: "emailRepliesPhoneLinkedin", label: "Email Replies, Phone call and Linkedin Note for each context" },
  { key: "rtrExplanation", label: "RTR Explanation" },
  { key: "jobApplicationProcessExplanation", label: "Job Application Process - Explanation" },
  { key: "emailSignature", label: "Email Signature" },
  { key: "storyExplanationByStaff", label: "Story Explanation by staff" },
  { key: "storyReturnScreenFromStudent", label: "Story return screen from student" },
  { key: "documentsPreparationByStaff", label: "Documents preparation by staff" },
  { key: "documentsVerificationByStudent", label: "Documents verification by Student" },
  { key: "nonTechnicalQuestionsExplanationByStaff", label: "Non-Technical Questions Explanation by staff" },
  { key: "nonTechnicalQuestionsByStudent", label: "Non-technical Questions by student" },
  { key: "resumePreparationByStaff", label: "Resume Preparation by staff" },
  { key: "resumeModificationByStudent", label: "Resume modification by student" },
  { key: "otterSetupTraining", label: "Otter setup, Otter training - 10 times" },
  { key: "fullScreeningEndToEnd", label: "Full Screening - end to end" },
] as const;

export const CHECKLIST_RATINGS = ["Excellent", "Good", "Average", "Bad"] as const;

export type PreMarketingChecklistKey = (typeof PREMARKETING_CHECKLIST_ITEMS)[number]["key"];
export type ChecklistRating = (typeof CHECKLIST_RATINGS)[number];

export type PreMarketingChecklistItem = {
  status: ChecklistRating | null;
  note: string;
};

export type PreMarketingChecklist = Record<PreMarketingChecklistKey, PreMarketingChecklistItem>;

export type ConsultantComment = {
  source: "pre-marketing" | "lead";
  scope?: "consultant" | "item";
  note: string;
  updatedAt: string;
  itemKey?: PreMarketingChecklistKey;
  item?: string;
  status?: ChecklistRating | null;
};

export const CHECKLIST_RATING_COLORS: Record<ChecklistRating, { bg: string; text: string; border: string }> = {
  Excellent: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Good: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  Average: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Bad: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export function emptyChecklistItem(): PreMarketingChecklistItem {
  return { status: null, note: "" };
}

export function emptyChecklist(): PreMarketingChecklist {
  return Object.fromEntries(
    PREMARKETING_CHECKLIST_ITEMS.map((item) => [item.key, emptyChecklistItem()])
  ) as PreMarketingChecklist;
}

function parseLegacyValue(value: unknown): PreMarketingChecklistItem {
  if (value && typeof value === "object" && "status" in value) {
    const raw = value as { status?: unknown; note?: unknown };
    const status = CHECKLIST_RATINGS.includes(raw.status as ChecklistRating)
      ? (raw.status as ChecklistRating)
      : null;
    return { status, note: typeof raw.note === "string" ? raw.note : "" };
  }
  if (value === true) return { status: "Good", note: "" };
  return emptyChecklistItem();
}

export function normalizeChecklist(value: unknown): PreMarketingChecklist {
  const base = emptyChecklist();
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  for (const item of PREMARKETING_CHECKLIST_ITEMS) {
    base[item.key] = parseLegacyValue(raw[item.key]);
  }
  return base;
}

export function checklistProgress(checklist: PreMarketingChecklist) {
  const total = PREMARKETING_CHECKLIST_ITEMS.length;
  const completed = PREMARKETING_CHECKLIST_ITEMS.filter((item) => checklist[item.key]?.status).length;
  const badCount = PREMARKETING_CHECKLIST_ITEMS.filter((item) => checklist[item.key]?.status === "Bad").length;
  const allTopThree = PREMARKETING_CHECKLIST_ITEMS.every((item) => {
    const status = checklist[item.key]?.status;
    return status === "Excellent" || status === "Good" || status === "Average";
  });
  return {
    completed,
    total,
    badCount,
    isComplete: completed === total,
    readyForMarketing: completed === total && allTopThree,
  };
}

export function normalizeConsultantComments(value: unknown): ConsultantComment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ConsultantComment => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    const isConsultantScoped =
      candidate.scope === "consultant" ||
      (!("scope" in candidate) && !("itemKey" in candidate) && !("item" in candidate) && !("status" in candidate));
    return (candidate.source === "pre-marketing" || candidate.source === "lead") && typeof candidate.note === "string" && isConsultantScoped;
  });
}

export function buildConsultantComment(consultantComment: string): ConsultantComment | null {
  const note = consultantComment.trim();
  if (!note) return null;
  return {
    source: "pre-marketing",
    scope: "consultant",
    note,
    updatedAt: new Date().toISOString(),
  };
}

export function getConsultantLevelComment(value: unknown): string {
  const comments = normalizeConsultantComments(value);
  return comments.find((comment) => comment.scope === "consultant")?.note ?? comments[0]?.note ?? "";
}

/** All consultant-scoped notes joined for editing as one global comment field. */
export function getConsultantLevelCommentsText(value: unknown): string {
  return normalizeConsultantComments(value)
    .map((comment) => comment.note.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Replace consultant-level notes while preserving lead-sourced or item-scoped entries. */
export function replaceConsultantLevelComments(value: unknown, note: string): ConsultantComment[] {
  const existing = Array.isArray(value) ? value : [];
  const preserved = existing.filter((item): item is ConsultantComment => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as ConsultantComment;
    if (candidate.source === "lead") return true;
    if (candidate.scope === "item" || candidate.itemKey || candidate.item || candidate.status) return true;
    return false;
  });
  const next = buildConsultantComment(note);
  return next ? [...preserved, next] : preserved;
}
