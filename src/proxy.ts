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
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/((?!auth/login|auth/activate).*)"],
};
