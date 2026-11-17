import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { canSeeAllLeads } from "./access";
import { fetchGoogleSheet, leadKey, parseLeadGrid, type SkippedRow } from "./import";
import { parseCsv } from "@/lib/csv";
import { saveImportedLeads } from "./save";

const KEY = "leads-team-sheet";

/**
 * The team sheet: ONE Google Sheet everybody fills in, shared as "Anyone with the link". The app
 * reads it through Google's public CSV export, so it needs no Google sign-in and no Google API.
 * Each row names its recruiter in the "Recruiter Email" column; that person owns the lead.
 */
export async function getTeamSheetUrl() {
  return (await prisma.appSetting.findUnique({ where: { key: KEY } }))?.value ?? null;
}

async function readTeamSheet(url: string) {
  const sheet = await fetchGoogleSheet(url);
  if ("error" in sheet) return sheet;
  return parseLeadGrid(parseCsv(sheet.bytes.toString("utf8").replace(/^\uFEFF/, "")));
}

/**
 * Managers: point the app at the team sheet, or clear it with null. Any Google Sheet works: it only
 * has to be shared "Anyone with the link" so the app can read it. Headings can be added later.
 */
export async function setTeamSheetUrl(url: string | null): Promise<{ error: string } | { url: string | null }> {
  if (!url) {
    await prisma.appSetting.deleteMany({ where: { key: KEY } });
    return { url: null };
  }
  const id = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url)?.[1];
  if (!id) return { error: "That is not a Google Sheets link. Copy it from the browser's address bar while the sheet is open." };
  const readable = await fetchGoogleSheet(url);
  if ("error" in readable) return readable;
  const gid = /[#?&]gid=(\d+)/.exec(url)?.[1];
  const clean = `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? `#gid=${gid}` : ""}`;
  await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: clean }, update: { value: clean } });
  return { url: clean };
}

/**
 * Loads rows from the team sheet; anyone can load. A row with a Recruiter Email goes to that recruiter
 * (a recruiter's own load takes only their rows, a manager's load takes everyone's). A row without one
 * (or a sheet without that column) goes to whoever loads it first, and is never loaded twice.
 */
export async function loadTeamSheet(session: SessionPayload): Promise<{ error: string } | { added: number; skipped: SkippedRow[] }> {
  const url = await getTeamSheetUrl();
  if (!url) return { error: "No team sheet is set up yet. Ask an admin to add it." };
  const parsed = await readTeamSheet(url);
  if ("error" in parsed) {
    // A new, blank team sheet: say what to do instead of "The file is empty"
    if (/empty|No known column headings/.test(parsed.error)) {
      return { error: 'The team sheet has no headings yet. Click "Copy column headings", click cell A1 in the sheet and paste, then add leads under them.' };
    }
    return parsed;
  }

  const everyone = canSeeAllLeads(session);
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u.id]));
  const myEmail = session.email.trim().toLowerCase();

  // Unclaimed rows: skip the ones that are already anyone's lead, so the first person to load takes them
  const allLeads = await prisma.lead.findMany({ select: { consultantName: true, email: true, phoneNumber: true } });
  const taken = new Set(allLeads.map(leadKey).filter(Boolean));

  const byOwner = new Map<string, typeof parsed.leads>();
  const skipped: SkippedRow[] = [];
  const add = (userId: string, entry: (typeof parsed.leads)[number]) => byOwner.set(userId, [...(byOwner.get(userId) ?? []), entry]);
  for (const entry of parsed.leads) {
    const owner = entry.owner ?? "";
    if (!owner) {
      const key = leadKey(entry.lead);
      if (key && taken.has(key)) skipped.push({ row: entry.row, reason: "Already loaded" });
      else add(session.userId, entry);
      continue;
    }
    const userId = userByEmail.get(owner);
    if (userId && (everyone || userId === session.userId)) add(userId, entry);
    else if (!userId && (everyone || owner === myEmail)) skipped.push({ row: entry.row, reason: `No app user has the email ${owner}` });
  }
  // Rows the reader rejected (bad status / date): a recruiter sees their own and unclaimed ones
  skipped.push(...parsed.skipped.filter((s) => everyone || !s.owner || s.owner === myEmail));

  let added = 0;
  for (const [userId, leads] of byOwner) {
    const res = await saveImportedLeads(userId, { leads, skipped: [] });
    added += res.added;
    skipped.push(...res.skipped.map((s) => (userId !== session.userId ? { ...s, reason: s.reason.replace("in your leads", "loaded") } : s)));
  }
  skipped.sort((a, b) => a.row - b.row);
  return { added, skipped };
}
