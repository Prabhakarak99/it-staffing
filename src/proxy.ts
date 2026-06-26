import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "it-staffing-super-secret-key-change-in-production"
);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/activate", "/api/auth/login", "/api/auth/activate"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("it-staff-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);

    // Not an /admin route — just verify the user is logged in
    if (!pathname.startsWith("/admin")) {
      return NextResponse.next();
    }

    const allowedScreens = payload.allowedScreens as string[] | null | undefined;

    // null = super admin, unrestricted access
    // undefined = old JWT without this field — treat as super admin for backwards compatibility
    if (allowedScreens === null || allowedScreens === undefined) {
      return NextResponse.next();
    }

    // Dashboard is always accessible to any authenticated user
    if (pathname === "/admin") {
      return NextResponse.next();
    }

    // A screen path like /admin/submissions also grants /admin/submissions/list
    // Skip /admin as a parent — it only represents the dashboard, not all admin pages
    const isAllowed = allowedScreens.some(
      (screen) =>
        screen !== "/admin" &&
        (pathname === screen || pathname.startsWith(screen + "/"))
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/((?!auth/login|auth/activate).*)"],
};
