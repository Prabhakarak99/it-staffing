import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getUserRelationCounts, userDeleteBlockMessage } from "@/lib/user-deletion";
import { Prisma } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
      email: body.email ?? undefined,
      phoneNumber: body.phoneNumber !== undefined ? (body.phoneNumber || null) : undefined,
      isActive: body.isActive ?? undefined,
      roleId: body.roleId !== undefined ? (body.roleId || null) : undefined,
    },
    include: { role: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  if (session.userId === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const counts = await getUserRelationCounts(id);
  const blockMessage = userDeleteBlockMessage(counts);
  if (blockMessage) {
    return NextResponse.json({ error: blockMessage }, { status: 409 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete user with existing linked records. Disable the account instead." },
        { status: 409 }
      );
    }
    console.error("DELETE /api/users/[id]", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
