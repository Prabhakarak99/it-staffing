import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { requireRequirementsAccess } from "@/lib/jobfeed/access";
import { parseCareersUrl } from "@/lib/jobfeed/ats";

/**
 * POST /api/job-sources/import — CSV with a careers URL column ("url", "careers", "link") and an
 * optional "name"/"company" column. Boards are not probed here (too slow for bulk); a bad board
 * shows its error on the Sources page after the first crawl.
 */
export async function POST(req: NextRequest) {
  const denied = await requireRequirementsAccess();
  if (denied) return denied;

  const file = (await req.formData()).get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded. Attach a CSV file as 'file'." }, { status: 400 });

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return NextResponse.json({ error: "CSV needs a header row and data rows." }, { status: 400 });

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const urlCol = headers.findIndex((h) => /url|career|link|board/.test(h));
  const nameCol = headers.findIndex((h) => /name|company/.test(h));
  if (urlCol === -1) {
    return NextResponse.json({ error: `No careers URL column found. Detected headers: ${rows[0].join(", ")}` }, { status: 400 });
  }

  const data: { name: string; provider: string; boardToken: string; workdayHost: string | null; workdaySite: string }[] = [];
  const unrecognised: string[] = [];
  for (const row of rows.slice(1)) {
    const url = (row[urlCol] ?? "").trim();
    if (!url) continue;
    const parsed = parseCareersUrl(url);
    if (!parsed) {
      unrecognised.push(url);
      continue;
    }
    data.push({
      name: (nameCol === -1 ? "" : (row[nameCol] ?? "").trim()) || parsed.suggestedName,
      provider: parsed.provider,
      boardToken: parsed.boardToken,
      workdayHost: parsed.workdayHost,
      workdaySite: parsed.workdaySite,
    });
  }

  // skipDuplicates honours the (provider, boardToken, workdaySite) unique key
  const { count } = await prisma.atsCompany.createMany({ data, skipDuplicates: true });
  return NextResponse.json({
    totalRows: rows.length - 1,
    inserted: count,
    duplicatesSkipped: data.length - count,
    unrecognised: unrecognised.slice(0, 20),
    unrecognisedCount: unrecognised.length,
  });
}
