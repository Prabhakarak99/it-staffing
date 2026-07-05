import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const requestedNext = req.nextUrl.searchParams.get("next") || "/admin";
  const nextPath = requestedNext.startsWith("/admin") ? requestedNext : "/admin";

  let allowedScreens: string[] | null = null;
  if (session.roleId) {
    const roleScreens = await prisma.roleScreen.findMany({
      where: { roleId: session.roleId, canView: true },
      include: { screen: true },
    });
    allowedScreens = roleScreens.map((rs) => rs.screen.path);
  }

  await createSession({
    userId: session.userId,
    email: session.email,
    roleId: session.roleId,
    roleName: session.roleName,
    allowedScreens,
  });

  const canAccessNext =
    allowedScreens === null ||
    nextPath === "/admin" ||
    allowedScreens.some(
      (screen) =>
        screen !== "/admin" &&
        (nextPath === screen || nextPath.startsWith(screen + "/"))
    );

  return NextResponse.redirect(new URL(canAccessNext ? nextPath : "/admin", req.url));
}
