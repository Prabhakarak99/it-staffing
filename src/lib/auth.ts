import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/** Production must set JWT_SECRET: a known fallback would let anyone sign a session for any company */
function secretKey() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "local-development-only-secret");
}

const COOKIE_NAME = "it-staff-session";
const EXPIRES_IN = 60 * 60 * 8; // 8 hours

/** Verified tokens, so the company filter can read the session on every query without re-checking the signature */
const verified = new Map<string, { session: SessionPayload; exp: number }>();

export interface SessionPayload {
  userId: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  allowedScreens: string[] | null; // null = Company Admin / Super Admin (every screen)
  /** The company this session works in (Super Admin: the company picked in the switcher) */
  companyId: string;
  companySlug: string;
  companyName: string;
  /** Signed in at the plain /login as Platform Super Admin */
  isPlatformAdmin?: boolean;
  /** Super Admin's "All companies" view: reads across every company */
  allCompanies?: boolean;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${EXPIRES_IN}s`)
    .setIssuedAt()
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: EXPIRES_IN,
    path: "/",
    sameSite: "lax",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const hit = verified.get(token);
    if (hit && hit.exp > Date.now() / 1000) return hit.session;
    const { payload } = await jwtVerify(token, secretKey());
    const session = payload as unknown as SessionPayload;
    // Sessions from before companies existed have no company: treat as signed out
    if (!session.companyId) return null;
    if (verified.size > 500) verified.clear();
    verified.set(token, { session, exp: Number(payload.exp ?? 0) });
    return session;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
