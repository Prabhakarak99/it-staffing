import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { canViewScreen } from "@/lib/screen-access";
import { EASY_SCREEN } from "./data";

type Access = { ok: false; response: NextResponse } | { ok: true; session: SessionPayload };

/** Signed in and allowed to open Easy Submissions */
export async function easyAccess(): Promise<Access> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canViewScreen(session, EASY_SCREEN.path))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
