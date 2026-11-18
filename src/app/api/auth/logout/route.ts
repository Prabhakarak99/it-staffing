import { NextRequest, NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity/log";
import { loginPath } from "@/lib/tenant/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) await logActivity({ kind: "logout", userId: session.userId, email: session.email }, req.headers);
  await deleteSession();
  // Back to the same login page: the company's link, or the plain /login for the Super Admin.
  // Relative Location keeps the user on the current host/port; 303 makes the browser follow with GET
  const to = session?.isPlatformAdmin ? "/login" : loginPath(session?.companySlug ?? req.cookies.get("it-staff-company")?.value);
  return new NextResponse(null, { status: 303, headers: { Location: to } });
}
