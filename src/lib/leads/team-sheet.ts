import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { canSeeAllLeads } from "./access";
import { fetchGoogleSheet, parseLeadGrid, type SkippedRow } from "./import";
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
  const parsed = parseLeadGrid(parseCsv(sheet.bytes.toString("utf8").replace(/^﻿/, "")));
  if ("error" in parsed) return parsed;
  if (!parsed.hasOwnerColumn) return { error: 'The sheet has no "Recruiter Email" column. Download the team sheet format and keep its headings.' };
  return parsed;
}

/** Managers: point the app at the team sheet (checked by reading it once), or clear it with null */
export async function setTeamSheetUrl(url: string | null): Promise<{ error: string } | { url: string | null }> {
  if (!url) {
    await prisma.appSetting.deleteMany({ where: { key: KEY } });
    return { url: null };
  }
  const id = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url)?.[1];
  if (!id) return { error: "That is not a Google Sheets link. Copy it from the browser's address bar while the sheet is open." };
  const check = await readTeamSheet(url);
  if ("error" in check) return check;
  const gid = /[#?&]gid=(\d+)/.exec(url)?.[1];
  const clean = `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? `#gid=${gid}` : ""}`;
  await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: clean }, update: { value: clean } });
  return { url: clean };
}

/**
 * Loads rows from the team sheet. A recruiter gets the rows carrying their own email; a manager's
 * load brings in everyone's rows, each to the recruiter named on it. Rows already loaded are skipped.
 */
export async function loadTeamSheet(session: SessionPayload): Promise<{ error: string } | { added: number; skipped: SkippedRow[] }> {
  const url = await getTeamSheetUrl();
  if (!url) return { error: "No team sheet is set up yet. Ask an admin to add it." };
  const parsed = await readTeamSheet(url);
  if ("error" in parsed) return parsed;

  const everyone = canSeeAllLeads(session);
  const users = await prisma.user.findMany({ where: everyone ? {} : { id: session.userId }, select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u.id]));
  const myEmail = users.find((u) => u.id === session.userId)?.email.trim().toLowerCase() ?? session.email.trim().toLowerCase();

  const byOwner = new Map<string, typeof parsed.leads>();
  const skipped: SkippedRow[] = [];
  for (const entry of parsed.leads) {
    const owner = entry.owner ?? "";
    const userId = userByEmail.get(owner);
    if (userId) {
      byOwner.set(userId, [...(byOwner.get(userId) ?? []), entry]);
    } else if (everyone) {
      // Only managers hear about rows nobody can claim; a recruiter's load just ignores other people's rows
      skipped.push({ row: entry.row, reason: owner ? `No app user has the email ${owner}` : "Recruiter Email is empty" });
    }
  }
  // Rows the reader rejected (bad status / date): show a recruiter only their own
  skipped.push(...parsed.skipped.filter((s) => everyone || s.owner === myEmail));

  let added = 0;
  for (const [userId, leads] of byOwner) {
    const res = await saveImportedLeads(userId, { leads, skipped: [] });
    added += res.added;
    skipped.push(...res.skipped.map((s) => (everyone && userId !== session.userId ? { ...s, reason: s.reason.replace("in your leads", "loaded") } : s)));
  }
  skipped.sort((a, b) => a.row - b.row);
  return { added, skipped };
}
