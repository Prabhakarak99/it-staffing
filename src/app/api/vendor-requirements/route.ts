import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { AiError } from "@/lib/ai/providers";
import { GmailNotConnectedError } from "@/lib/gmail/oauth";
import { VENDOR_REQ_SCREEN } from "@/lib/requirements/constants";
import { listRequirements } from "@/lib/requirements/data";
import { scanInbox } from "@/lib/requirements/scan";

export const maxDuration = 300;

async function access() {
  const session = await getSession();
  if (!session) return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!(await canViewScreen(session, VENDOR_REQ_SCREEN.path))) return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { session } as const;
}

/**
 * GET — requirements this user may see.
 * GET ?since=ISO — only ones stored after `since` (the new-requirement popup), plus the server time.
 */
export async function GET(req: NextRequest) {
  const a = await access();
  if ("denied" in a) return a.denied;
  const since = req.nextUrl.searchParams.get("since");
  if (since !== null) {
    const after = new Date(since);
    const now = new Date().toISOString();
    if (Number.isNaN(after.getTime())) return NextResponse.json({ items: [], now });
    const items = await listRequirements(a.session, { createdAfter: after, days: 3, limit: 10 });
    return NextResponse.json({
      now,
      items: items.map((r) => ({
        id: r.id, jobTitle: r.jobTitle, technology: r.technology, clientName: r.clientName,
        vendorCompany: r.vendorCompany, source: r.source.name, mine: r.mine,
      })),
    });
  }
  return NextResponse.json(await listRequirements(a.session));
}

/** POST — read my own inbox now instead of waiting for the next automatic check */
export async function POST() {
  const a = await access();
  if ("denied" in a) return a.denied;
  try {
    return NextResponse.json(await scanInbox(a.session.userId));
  } catch (err) {
    if (err instanceof GmailNotConnectedError || err instanceof AiError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[requirements] manual scan:", err);
    return NextResponse.json({ error: "Could not read your inbox. Try again in a minute." }, { status: 500 });
  }
}
