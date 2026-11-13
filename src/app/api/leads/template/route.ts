import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { leadTemplate } from "@/lib/leads/import";

/** GET /api/leads/template — the blank sheet for uploading leads */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return new NextResponse(new Uint8Array(await leadTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Leads_Upload_Format.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
