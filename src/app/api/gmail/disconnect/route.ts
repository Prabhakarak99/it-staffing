import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disconnect } from "@/lib/gmail/oauth";

/** POST /api/gmail/disconnect — revoke the signed-in user's own Gmail access */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnect(session.userId);
  return NextResponse.json({ success: true });
}
