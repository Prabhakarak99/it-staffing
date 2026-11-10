import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { myEmailSetup, parseTemplate } from "@/lib/email-templates/data";

type RouteContext = { params: Promise<{ id: string }> };

/** The template, only when it belongs to the signed-in user */
async function own(id: string) {
  const session = await getSession();
  if (!session) return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const template = await prisma.emailTemplate.findFirst({ where: { id, userId: session.userId } });
  if (!template) return { denied: NextResponse.json({ error: "Template not found" }, { status: 404 }) } as const;
  return { session, template } as const;
}

/** PATCH { name, category, subject, body, isDefault } */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const found = await own((await params).id);
  if ("denied" in found) return found.denied;
  const { session, template } = found;

  const parsed = parseTemplate((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data } = parsed;
  await prisma.$transaction([
    ...(data.isDefault
      ? [prisma.emailTemplate.updateMany({ where: { userId: session.userId, category: data.category, id: { not: template.id } }, data: { isDefault: false } })]
      : []),
    prisma.emailTemplate.update({ where: { id: template.id }, data }),
  ]);
  return NextResponse.json(await myEmailSetup(session.userId));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const found = await own((await params).id);
  if ("denied" in found) return found.denied;
  await prisma.emailTemplate.delete({ where: { id: found.template.id } });
  return NextResponse.json(await myEmailSetup(found.session.userId));
}
