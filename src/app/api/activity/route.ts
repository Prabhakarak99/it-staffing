import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity/log";

/** A tab opened in the app (sent by the shell on every navigation) */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path.split("?")[0] : "";
  if (!path.startsWith("/admin")) return NextResponse.json({ error: "Bad path" }, { status: 400 });
  await logActivity({ kind: "page", userId: session.userId, email: session.email, path }, req.headers);
  return NextResponse.json({ ok: true });
}
