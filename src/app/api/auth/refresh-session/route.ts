import { NextRequest, NextResponse } from "next/server";
import { unscopedPrisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/auth";
import { appOrigin } from "@/lib/app-url";
import { loginPath, sessionFor } from "@/lib/tenant/session";

/** Re-reads the user's role and screens (after an admin changed them), keeping their company */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(loginPath(req.cookies.get("it-staff-company")?.value), appOrigin()));

  const requestedNext = req.nextUrl.searchParams.get("next") || "/admin";
  const nextPath = requestedNext.startsWith("/admin") ? requestedNext : "/admin";

  const [user, company] = await Promise.all([
    unscopedPrisma.user.findUnique({ where: { id: session.userId }, include: { role: true } }),
    unscopedPrisma.company.findUnique({ where: { id: session.companyId } }),
  ]);
  if (!user || !user.isActive || !company || company.status !== "active" || (session.isPlatformAdmin && !user.isPlatformAdmin)) {
    return NextResponse.redirect(new URL(loginPath(session.companySlug), appOrigin()));
  }

  const fresh = await sessionFor(user, company, !!session.isPlatformAdmin);
  await createSession({ ...fresh, allCompanies: session.isPlatformAdmin ? session.allCompanies : false });

  const allowedScreens = fresh.allowedScreens;
  const canAccessNext =
    allowedScreens === null ||
    nextPath === "/admin" ||
    allowedScreens.some((screen) => screen !== "/admin" && (nextPath === screen || nextPath.startsWith(screen + "/")));

  return NextResponse.redirect(new URL(canAccessNext ? nextPath : "/admin", appOrigin()));
}
