import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const person = await prisma.techSupport.update({
    where: { id },
    data: {
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
      email: body.email ?? undefined,
      phoneNumber: body.phoneNumber ?? undefined,
    },
  });

  return NextResponse.json(person);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.techSupport.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
