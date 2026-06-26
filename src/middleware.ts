import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "it-staffing-super-secret-key-change-in-production"
);

const COOKIE_NAME = "it-staff-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce access control under /admin
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const allowedScreens = payload.allowedScreens as string[] | null;

    // Super admin — null means unrestricted
    if (allowedScreens === null) {
      return NextResponse.next();
    }

    // Dashboard is always accessible to any logged-in user
    if (pathname === "/admin") {
      return NextResponse.next();
    }

    // Check if the current path matches any allowed screen
    // A screen path like /admin/submissions also grants /admin/submissions/list
    const isAllowed = allowedScreens.some(
      (screen) => pathname === screen || pathname.startsWith(screen + "/")
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
