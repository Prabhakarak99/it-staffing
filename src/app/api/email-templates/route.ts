import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_SIGNATURE, MAX_TEMPLATES, myEmailSetup, parseTemplate } from "@/lib/email-templates/data";

/** GET — the signed-in user's own signature and templates */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await myEmailSetup(session.userId));
}

/** POST { name, category, subject, body, isDefault } — a new template for the signed-in user */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseTemplate((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if ((await prisma.emailTemplate.count({ where: { userId: session.userId } })) >= MAX_TEMPLATES) {
    return NextResponse.json({ error: `You can keep up to ${MAX_TEMPLATES} templates. Delete one first.` }, { status: 400 });
  }

  const { data } = parsed;
  await prisma.$transaction([
    // One default per category
    ...(data.isDefault ? [prisma.emailTemplate.updateMany({ where: { userId: session.userId, category: data.category }, data: { isDefault: false } })] : []),
    prisma.emailTemplate.create({ data: { ...data, userId: session.userId } }),
  ]);
  return NextResponse.json(await myEmailSetup(session.userId), { status: 201 });
}

/** PUT { signature } — the signed-in user's email signature */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { signature?: unknown };
  if (typeof body.signature !== "string") return NextResponse.json({ error: "signature is required" }, { status: 400 });
  const signature = body.signature.replace(/\r\n/g, "\n").trim();
  if (signature.length > MAX_SIGNATURE) return NextResponse.json({ error: `Keep the signature under ${MAX_SIGNATURE} characters` }, { status: 400 });

  await prisma.user.update({ where: { id: session.userId }, data: { emailSignature: signature || null } });
  return NextResponse.json(await myEmailSetup(session.userId));
}
