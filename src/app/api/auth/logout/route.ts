import { NextRequest, NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity/log";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) await logActivity({ kind: "logout", userId: session.userId, email: session.email }, req.headers);
  await deleteSession();
  // Relative Location keeps the user on the current host/port; 303 makes the browser follow with GET
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
