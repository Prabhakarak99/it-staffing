import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewScreen } from "@/lib/screen-access";
import { EASY_SCREEN } from "./data";

type Access = { ok: false; response: NextResponse } | { ok: true; session: SessionPayload };

/** Whether the admin has switched Easy Submissions off for this user (Super Admin never is) */
export async function easyDisabledFor(session: SessionPayload) {
  if (!session.roleId) return false;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { easySubmissionsEnabled: true } });
  return !user?.easySubmissionsEnabled;
}

/** The role can open the screen and the admin hasn't switched it off for this user */
export async function canUseEasy(session: SessionPayload) {
  return (await canViewScreen(session, EASY_SCREEN.path)) && !(await easyDisabledFor(session));
}

/** Signed in and allowed to use Easy Submissions */
export async function easyAccess(): Promise<Access> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canUseEasy(session))) {
    return { ok: false, response: NextResponse.json({ error: "Easy Submissions is turned off for your account" }, { status: 403 }) };
  }
  return { ok: true, session };
}
