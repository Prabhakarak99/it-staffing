import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/gmail/crypto";
import { GmailAuthError, refreshAccessToken } from "@/lib/gmail/oauth";
import { LEAD_STATUSES, LEAD_VISA_STATUSES } from "./fields";
import { LEAD_SHEET_HEADERS, MAX_IMPORT_ROWS } from "./import";

/** Only files this app creates: it cannot see anything else in the person's Google Drive */
export const SHEET_SCOPE = "https://www.googleapis.com/auth/drive.file";
/** Third part of the OAuth state when the sign-in is for the Leads sheet (see /api/gmail/callback) */
export const SHEET_STATE = "sheet";

export class LeadSheetError extends Error {
  constructor(message: string, readonly code: "not_connected" | "gone" | "google" = "google") {
    super(message);
  }
}

export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

export async function saveSheetTokens(userId: string, tokens: { access_token: string; expires_in: number; refresh_token?: string; scope?: string }) {
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token; please try connecting again");
  if (tokens.scope && !tokens.scope.split(" ").includes(SHEET_SCOPE)) {
    throw new Error("Google Drive access wasn't allowed. Connect again and tick the Google Drive permission before clicking Continue.");
  }
  const data = {
    refreshTokenEnc: encrypt(tokens.refresh_token),
    accessTokenEnc: encrypt(tokens.access_token),
    accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
  };
  await prisma.leadSheet.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

async function accessToken(userId: string) {
  const row = await prisma.leadSheet.findUnique({ where: { userId } });
  if (!row) throw new LeadSheetError("Google Sheets is not connected", "not_connected");
  if (row.accessTokenEnc && row.accessTokenExpiry && row.accessTokenExpiry.getTime() > Date.now() + 60_000) return decrypt(row.accessTokenEnc);
  try {
    const tokens = await refreshAccessToken(decrypt(row.refreshTokenEnc));
    await prisma.leadSheet.update({
      where: { userId },
      data: { accessTokenEnc: encrypt(tokens.access_token), accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000) },
    });
    return tokens.access_token;
  } catch (err) {
    if (err instanceof GmailAuthError && err.code === "invalid_grant") {
      await prisma.leadSheet.delete({ where: { userId } });
      throw new LeadSheetError("Google access expired. Connect Google Sheets again.", "not_connected");
    }
    throw err;
  }
}

async function google<T>(token: string, url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string; details?: { reason?: string }[] } } | null;
  console.error("[lead-sheet] Google request failed:", res.status, JSON.stringify(body?.error ?? {}));
  if (res.status === 404) throw new LeadSheetError("The Google Sheet was deleted.", "gone");
  if (body?.error?.details?.some((d) => d.reason === "SERVICE_DISABLED")) {
    throw new LeadSheetError("The Google Sheets API is not turned on for this Google Cloud project. An admin needs to enable \"Google Sheets API\" in the Google Cloud console (APIs & Services > Library), wait a minute, then try again.");
  }
  if (res.status === 403) throw new LeadSheetError("Google refused access to the sheet. Disconnect and connect Google Sheets again, ticking the Google Drive permission.");
  throw new LeadSheetError(`Google Sheets error (${res.status}): ${body?.error?.message ?? "unknown reason"}`);
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";

/** Creates the person's Leads sheet in their Google Drive, with the headings and dropdowns, and remembers it */
export async function createLeadSheet(userId: string, ownerName: string) {
  const token = await accessToken(userId);
  const cols = LEAD_SHEET_HEADERS.length;
  const created = await google<{ spreadsheetId: string; sheets: { properties: { sheetId: number } }[] }>(token, API, {
    method: "POST",
    body: {
      properties: { title: `GFT Vision Leads - ${ownerName}` },
      sheets: [{
        properties: { title: "Leads", gridProperties: { rowCount: MAX_IMPORT_ROWS + 1, columnCount: cols, frozenRowCount: 1 } },
        data: [{ startRow: 0, startColumn: 0, rowData: [{ values: LEAD_SHEET_HEADERS.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
      }],
    },
  });
  const sheetId = created.sheets[0].properties.sheetId;
  const column = (name: string) => LEAD_SHEET_HEADERS.indexOf(name);
  const body = (col: number) => ({ sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 });
  const dropdown = (col: number, values: readonly string[], strict: boolean) => ({
    setDataValidation: {
      range: body(col),
      rule: { condition: { type: "ONE_OF_LIST", values: values.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict },
    },
  });
  const format = (col: number, type: string, pattern?: string) => ({
    repeatCell: { range: body(col), cell: { userEnteredFormat: { numberFormat: { type, ...(pattern ? { pattern } : {}) } } }, fields: "userEnteredFormat.numberFormat" },
  });
  await google(token, `${API}/${created.spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.118, green: 0.161, blue: 0.231 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        dropdown(column("Visa Status"), LEAD_VISA_STATUSES, false),
        dropdown(column("Status"), LEAD_STATUSES, true),
        // Phone numbers as text (keeps "+" and leading zeros); dates always read back as yyyy-mm-dd
        format(column("Contact Number"), "TEXT"),
        format(column("OPT Start Date"), "DATE", "yyyy-mm-dd"),
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: cols }, properties: { pixelSize: 170 }, fields: "pixelSize" } },
      ],
    },
  });
  await prisma.leadSheet.update({ where: { userId }, data: { spreadsheetId: created.spreadsheetId } });
  return created.spreadsheetId;
}

/** The rows of the person's sheet (first tab), headings included, as text */
export async function readLeadSheet(userId: string): Promise<string[][]> {
  const row = await prisma.leadSheet.findUnique({ where: { userId }, select: { spreadsheetId: true } });
  if (!row) throw new LeadSheetError("Google Sheets is not connected", "not_connected");
  if (!row.spreadsheetId) throw new LeadSheetError("The Google Sheet has not been created yet.", "gone");
  const token = await accessToken(userId);
  try {
    const res = await google<{ values?: unknown[][] }>(token, `${API}/${row.spreadsheetId}/values/${encodeURIComponent(`A1:I${MAX_IMPORT_ROWS + 1}`)}?valueRenderOption=FORMATTED_VALUE`);
    return (res.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
  } catch (err) {
    if (err instanceof LeadSheetError && err.code === "gone") await prisma.leadSheet.update({ where: { userId }, data: { spreadsheetId: null } });
    throw err;
  }
}

/** Forgets the connection and revokes it at Google (best effort). The sheet stays in the person's Drive. */
export async function disconnectLeadSheet(userId: string) {
  const row = await prisma.leadSheet.findUnique({ where: { userId } });
  if (!row) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(row.refreshTokenEnc))}`, { method: "POST" });
  } catch {
    // Already revoked or unreachable; deleting locally is what matters
  }
  await prisma.leadSheet.delete({ where: { userId } });
}
