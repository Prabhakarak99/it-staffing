import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { unscopedPrisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity/log";
import { runAs } from "@/lib/tenant/context";
import { COMPANY_HINT_COOKIE, companyBySlug, sessionFor } from "@/lib/tenant/session";

/**
 * POST { email, password, company? }
 * - With a company (from the login page's ?company=<slug>): only that company's users can sign in.
 * - Without one (the plain /login): only the Platform Super Admin.
 * Every failure gives the same answer, so the page never reveals which company an email belongs to.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, company: slug } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const company = slug ? await companyBySlug(String(slug)) : null;
    if (slug && !company) return NextResponse.json({ error: "Company not found. Check the login link." }, { status: 404 });
    if (company && company.status !== "active") {
      return NextResponse.json({ error: "This company's access is suspended. Contact your administrator." }, { status: 403 });
    }
    const failed = company ? "Invalid credentials" : "Invalid credentials. Staff: please use your company's login link.";

    // Emails are matched ignoring capitals; an exact match wins. If several older accounts differ
    // only by case, the one whose password matches signs in.
    const typed = String(email).trim();
    const candidates = await unscopedPrisma.user.findMany({
      where: {
        email: { equals: typed, mode: "insensitive" },
        ...(company ? { companyId: company.id } : { isPlatformAdmin: true }),
      },
      include: { role: true, company: true },
    });
    candidates.sort((a, b) => Number(b.email === typed) - Number(a.email === typed));

    let user: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(password, c.password)) {
        user = c;
        break;
      }
    }

    const target = candidates[0];
    if (!user || !user.isActive) {
      if (target) await runAs(target.companyId, () => logActivity({ kind: "login_failed", userId: target.id, email: typed }, req.headers));
      return NextResponse.json({ error: user ? `${failed} Or the account is not active.` : failed }, { status: 401 });
    }

    // Plain /login = Platform Super Admin, starting in their own company with the "All companies" view
    const home = company ?? user.company;
    const session = await sessionFor(user, home, !company);
    await createSession(session);
    await runAs(home.id, () => logActivity({ kind: "login", userId: user.id, email: user.email }, req.headers));

    const res = NextResponse.json({ success: true });
    res.cookies.set(COMPANY_HINT_COOKIE, company ? company.slug : "platform", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
