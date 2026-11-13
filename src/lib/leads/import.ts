import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/csv";
import { LEAD_STATUSES, LEAD_VISA_STATUSES, US_STATES, type LeadStatus } from "./fields";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Template columns, in order. `aliases` are other headings people use for the same thing. */
const COLUMNS = [
  { key: "consultantName", header: "Full Name", width: 26, aliases: ["name", "consultant name", "lead name", "candidate name"] },
  { key: "phoneNumber", header: "Contact Number", width: 18, aliases: ["phone", "phone number", "mobile", "contact", "contact no"] },
  { key: "email", header: "Email ID", width: 30, aliases: ["email", "e-mail", "email address", "mail id"] },
  { key: "visaStatus", header: "Visa Status", width: 14, aliases: ["visa"] },
  { key: "optStartDate", header: "OPT Start Date", width: 16, aliases: ["opt start", "opt date"] },
  { key: "university", header: "University", width: 28, aliases: ["college", "university name"] },
  { key: "state", header: "State", width: 18, aliases: [] },
  { key: "status", header: "Status", width: 16, aliases: ["lead status"] },
  { key: "comments", header: "Comments", width: 40, aliases: ["comment", "notes", "remarks"] },
] as const;
type Key = (typeof COLUMNS)[number]["key"];

/** Column headings in sheet order */
export const LEAD_SHEET_HEADERS: string[] = COLUMNS.map((c) => c.header);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_KEY = new Map<string, Key>(COLUMNS.flatMap((c) => [c.header, ...c.aliases].map((h) => [norm(h), c.key] as const)));
const STATUS_BY_NORM = new Map<string, LeadStatus>(LEAD_STATUSES.map((s) => [norm(s), s]));

/** The blank workbook people fill in (also opens in Google Sheets) */
export async function leadTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GFT Vision";
  const ws = wb.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  });
  // Phone numbers as text so leading zeros and "+" survive
  ws.getColumn("phoneNumber").numFmt = "@";
  ws.getColumn("optStartDate").numFmt = "yyyy-mm-dd";

  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 22 }, { width: 90 }];
  const lines: [string, string][] = [
    ["How to use", "Fill the Leads sheet, one lead per row, starting at row 2. Keep the headings in row 1. No column is mandatory; empty rows are skipped."],
    ["Google Sheets", "Upload this file to Google Drive and open it with Google Sheets. When finished: File > Download > Microsoft Excel (.xlsx) or Comma-separated values (.csv), then upload that file."],
    ["Status", `${LEAD_STATUSES.join(", ")}. Left empty, the lead is saved as Interested.`],
    ["Visa Status", LEAD_VISA_STATUSES.join(", ")],
    ["OPT Start Date", "A date, for example 2026-11-01 or 11/01/2026 (month/day/year)."],
    ["State", "Full US state name, for example Texas."],
    ["Duplicates", "A row is skipped when you already have a lead with the same email (or, with no email, the same name and contact number)."],
    ["Limit", `Up to ${MAX_IMPORT_ROWS} rows per file.`],
  ];
  for (const l of lines) help.addRow(l);
  help.getColumn(1).font = { bold: true };
  help.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  // Dropdowns on the first 1,000 rows
  const statusRef = `"${LEAD_STATUSES.join(",")}"`;
  const visaRef = `"${LEAD_VISA_STATUSES.join(",")}"`;
  for (let r = 2; r <= 1001; r++) {
    ws.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [visaRef], showErrorMessage: false };
    ws.getCell(`H${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [statusRef] };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The same headings as a plain CSV, which Google Sheets opens directly */
export const leadTemplateCsv = () => `﻿${COLUMNS.map((c) => c.header).join(",")}\r\n`;

/**
 * Downloads a Google Sheet as CSV from its link. Only the sheet id (and tab id) are taken from the
 * link, so the request can only ever go to Google. The sheet must be shared "Anyone with the link".
 */
export async function fetchGoogleSheet(link: string): Promise<{ error: string } | { bytes: Buffer }> {
  const id = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(link)?.[1];
  if (!id) return { error: "That is not a Google Sheets link. Copy the link from the browser's address bar while the sheet is open." };
  const gid = /[#?&]gid=(\d+)/.exec(link)?.[1];
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`, {
    redirect: "follow", signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) return { error: "Could not reach Google Sheets. Try again." };
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/csv")) {
    return { error: 'Google did not let us read the sheet. In the sheet click Share, set General access to "Anyone with the link" (Viewer), then try again.' };
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > MAX_IMPORT_BYTES ? { error: "The sheet is larger than 5 MB" } : { bytes };
}

type Cell = string | Date;

async function readGrid(name: string, bytes: Buffer): Promise<Cell[][] | { error: string }> {
  if (/\.csv$/i.test(name)) return parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  if (!/\.xlsx$/i.test(name)) return { error: "Upload an Excel (.xlsx) or CSV (.csv) file. From Google Sheets use File > Download." };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    return { error: "Could not read the file. Save it as .xlsx or .csv and try again." };
  }
  const ws = wb.getWorksheet("Leads") ?? wb.worksheets[0];
  if (!ws) return { error: "The file has no sheets" };
  const grid: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const v = cell.value;
      const result = v && typeof v === "object" && "result" in v ? v.result : v;
      cells[col - 1] = result instanceof Date ? result : (cell.text ?? "").toString();
    });
    for (let i = 0; i < cells.length; i++) cells[i] ??= "";
    grid.push(cells);
  });
  return grid;
}

function parseDate(v: Cell): Date | null | "bad" {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "bad" : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = v.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return "bad";
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : "bad";
}

export interface ParsedLead {
  consultantName: string;
  email: string;
  phoneNumber: string | null;
  visaStatus: string | null;
  university: string | null;
  state: string | null;
  optStartDate: Date | null;
  status: LeadStatus;
  comments: string | null;
}
export interface SkippedRow { row: number; reason: string }

/** Reads an uploaded sheet into leads; rows that can't be used come back in `skipped` with their sheet row number */
export async function parseLeadSheet(name: string, bytes: Buffer): Promise<{ error: string } | { leads: { row: number; lead: ParsedLead }[]; skipped: SkippedRow[] }> {
  const grid = await readGrid(name, bytes);
  return "error" in grid ? grid : parseLeadGrid(grid);
}

/** The same for rows already read (first row = headings) */
export function parseLeadGrid(grid: (string | Date)[][]): { error: string } | { leads: { row: number; lead: ParsedLead }[]; skipped: SkippedRow[] } {
  if (grid.length === 0) return { error: "The file is empty" };

  const keys = grid[0].map((h) => HEADER_KEY.get(norm(String(h))));
  if (!keys.some(Boolean)) return { error: "No known column headings in the first row. Download the format and keep its headings." };
  if (grid.length - 1 > MAX_IMPORT_ROWS) return { error: `The file has ${grid.length - 1} rows; upload up to ${MAX_IMPORT_ROWS} at a time.` };

  const visaByNorm = new Map(LEAD_VISA_STATUSES.map((v) => [norm(v), v]));
  const stateByNorm = new Map(US_STATES.map((v) => [norm(v), v]));
  const leads: { row: number; lead: ParsedLead }[] = [];
  const skipped: SkippedRow[] = [];

  grid.slice(1).forEach((cells, i) => {
    const row = i + 2;
    const raw: Partial<Record<Key, Cell>> = {};
    keys.forEach((k, c) => { if (k && raw[k] === undefined) raw[k] = cells[c] ?? ""; });
    const str = (k: Key) => { const v = raw[k]; return v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? "").trim(); };
    if (COLUMNS.every((c) => !str(c.key))) return;

    const statusText = str("status");
    const status = statusText ? STATUS_BY_NORM.get(norm(statusText)) : "Interested";
    if (!status) return void skipped.push({ row, reason: `Status "${statusText}" is not one of: ${LEAD_STATUSES.join(", ")}` });
    const optStartDate = parseDate(raw.optStartDate ?? "");
    if (optStartDate === "bad") return void skipped.push({ row, reason: `OPT Start Date "${str("optStartDate")}" is not a date (use 2026-11-01 or 11/01/2026)` });

    const visa = str("visaStatus");
    const state = str("state");
    leads.push({
      row,
      lead: {
        consultantName: str("consultantName"),
        email: str("email"),
        phoneNumber: str("phoneNumber") || null,
        visaStatus: visa ? visaByNorm.get(norm(visa)) ?? visa : null,
        university: str("university") || null,
        state: state ? stateByNorm.get(norm(state)) ?? state : null,
        optStartDate,
        status,
        comments: str("comments") || null,
      },
    });
  });
  return { leads, skipped };
}

/** Same person as an existing lead: by email, or by name + number when there is no email (null: nothing to compare) */
export const leadKey = (l: { consultantName: string; email: string; phoneNumber: string | null }) => {
  if (l.email.trim()) return `e:${l.email.trim().toLowerCase()}`;
  const [name, phone] = [norm(l.consultantName), (l.phoneNumber ?? "").replace(/\D/g, "")];
  return name || phone ? `n:${name}|${phone}` : null;
};
