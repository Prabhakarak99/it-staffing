import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/** Production must set JWT_SECRET: a known fallback would let anyone sign a session for any company */
function secretKey() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "local-development-only-secret");
}

const PUBLIC_PATHS = [
  "/login", "/activate", "/reset-password",
  "/api/auth/login", "/api/auth/activate", "/api/auth/reset-password", "/api/auth/refresh-session", "/api/auth/company",
  "/api/integrations/codevision",
];

/**
 * Not signed in: pages go to the user's own company login page (remembered in a non-secret cookie);
 * API calls get 401, so a page can say "your login expired" instead of failing on a redirect.
 */
function signedOut(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Your login has expired. Please sign in again." }, { status: 401 });
  }
  const slug = req.cookies.get("it-staff-company")?.value;
  const login = new URL("/login", req.url);
  if (slug && slug !== "platform") login.searchParams.set("company", slug);
  return NextResponse.redirect(login);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const refreshUrl = new URL("/api/auth/refresh-session", req.url);
  refreshUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("it-staff-session")?.value;
  if (!token) return signedOut(req);

  try {
    const { payload } = await jwtVerify(token, secretKey());
    // Sessions from before companies existed carry no company: sign in again through the company link
    if (!payload.companyId) return signedOut(req);

    // Not an /admin route — just verify the user is logged in
    if (!pathname.startsWith("/admin")) return NextResponse.next();

    const allowedScreens = payload.allowedScreens as string[] | null | undefined;
    // undefined = stale JWT without allowedScreens — refresh it from DB
    if (allowedScreens === undefined) return NextResponse.redirect(refreshUrl);
    // null = Company Admin / Super Admin: every screen
    if (allowedScreens === null) return NextResponse.next();
    // Dashboard is always accessible to any authenticated user
    if (pathname === "/admin") return NextResponse.next();

    // A screen path like /admin/submissions also grants /admin/submissions/list
    // Skip /admin as a parent — it only represents the dashboard, not all admin pages
    const isAllowed = allowedScreens.some((screen) => screen !== "/admin" && (pathname === screen || pathname.startsWith(screen + "/")));
    return isAllowed ? NextResponse.next() : NextResponse.redirect(refreshUrl);
  } catch {
    return signedOut(req);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/((?!auth/login|auth/activate).*)"],
};
