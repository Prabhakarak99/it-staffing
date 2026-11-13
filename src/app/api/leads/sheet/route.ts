import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseLeadGrid } from "@/lib/leads/import";
import { saveImportedLeads } from "@/lib/leads/save";
import { LeadSheetError, createLeadSheet, disconnectLeadSheet, readLeadSheet, sheetUrl } from "@/lib/leads/sheet";

export const maxDuration = 60;

const fail = (err: unknown, fallback: string) => {
  if (err instanceof LeadSheetError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
  console.error("[lead-sheet]", err);
  return NextResponse.json({ error: fallback }, { status: 500 });
};

/** GET /api/leads/sheet — is the signed-in user's Google Sheet connected, and its link */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await prisma.leadSheet.findUnique({ where: { userId: session.userId }, select: { spreadsheetId: true } });
  return NextResponse.json({ connected: !!row, url: row?.spreadsheetId ? sheetUrl(row.spreadsheetId) : null });
}

/** POST /api/leads/sheet — load the sheet's rows as leads; `?create=1` makes a new sheet instead (when it was deleted) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (new URL(req.url).searchParams.get("create")) {
      const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
      const id = await createLeadSheet(session.userId, me ? `${me.firstName} ${me.lastName}`.trim() : session.email);
      return NextResponse.json({ connected: true, url: sheetUrl(id) });
    }
    const parsed = parseLeadGrid(await readLeadSheet(session.userId));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return NextResponse.json(await saveImportedLeads(session.userId, parsed));
  } catch (err) {
    return fail(err, "Could not load the Google Sheet");
  }
}

/** DELETE /api/leads/sheet — disconnect Google Sheets (the sheet itself stays in the person's Drive) */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await disconnectLeadSheet(session.userId);
    return NextResponse.json({ connected: false, url: null });
  } catch (err) {
    return fail(err, "Could not disconnect");
  }
}
