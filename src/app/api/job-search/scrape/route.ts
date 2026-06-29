import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAllScrapers } from "@/lib/apify/scraperService";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_TOKEN is not configured. Add it to your environment variables." }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sources = body.sources ?? undefined;

    const result = await runAllScrapers(sources);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scraping failed";
    console.error("[Scrape] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
