import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MAX_IMPORT_BYTES, fetchGoogleSheet, leadKey, parseLeadSheet, type SkippedRow } from "@/lib/leads/import";

export const maxDuration = 60;

/** POST /api/leads/import (multipart, field "file" or a Google Sheets link in "sheetUrl") — adds the sheet's rows as the signed-in user's leads */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const sheetUrl = form.get("sheetUrl");
    let name: string;
    let bytes: Buffer;
    if (typeof sheetUrl === "string" && sheetUrl.trim()) {
      const sheet = await fetchGoogleSheet(sheetUrl.trim());
      if ("error" in sheet) return NextResponse.json({ error: sheet.error }, { status: 400 });
      [name, bytes] = ["sheet.csv", sheet.bytes];
    } else {
      if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file or paste a Google Sheets link" }, { status: 400 });
      if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "The file is larger than 5 MB" }, { status: 400 });
      [name, bytes] = [file.name, Buffer.from(await file.arrayBuffer())];
    }

    const parsed = await parseLeadSheet(name, bytes);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const mine = await prisma.lead.findMany({
      where: { createdById: session.userId },
      select: { consultantName: true, email: true, phoneNumber: true },
    });
    const seen = new Set(mine.map(leadKey).filter(Boolean));
    const skipped: SkippedRow[] = [...parsed.skipped];
    const data = [];
    for (const { row, lead } of parsed.leads) {
      const key = leadKey(lead);
      if (key && seen.has(key)) {
        skipped.push({ row, reason: `Already in your leads${lead.email ? ` (${lead.email})` : ""}` });
        continue;
      }
      if (key) seen.add(key);
      data.push({ ...lead, createdById: session.userId });
    }
    if (data.length) await prisma.lead.createMany({ data });

    skipped.sort((a, b) => a.row - b.row);
    return NextResponse.json({ added: data.length, skipped });
  } catch (err) {
    console.error("[leads] import failed:", err);
    return NextResponse.json({ error: "Could not import the file" }, { status: 500 });
  }
}
