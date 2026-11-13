import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { leadTemplate, leadTemplateCsv } from "@/lib/leads/import";

/** GET /api/leads/template[?format=csv] — the blank sheet for uploading leads (Excel, or CSV for Google Sheets) */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(leadTemplateCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Leads_Upload_Format.csv"',
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(new Uint8Array(await leadTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Leads_Upload_Format.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
