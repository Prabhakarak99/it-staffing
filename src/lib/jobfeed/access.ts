import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** Job-source management follows the Requirements screen permission. Returns an error response, or null when allowed. */
export async function requireRequirementsAccess() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.allowedScreens && !session.allowedScreens.includes("/admin/requirements")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
