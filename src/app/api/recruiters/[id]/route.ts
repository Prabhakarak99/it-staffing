import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getUserRelationCounts, userDeleteBlockMessage } from "@/lib/user-deletion";
import { Prisma } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
      ...(body.businessNumber !== undefined && { businessNumber: body.businessNumber }),
      ...(body.fullAddress !== undefined && { fullAddress: body.fullAddress }),
      ...(body.experience !== undefined && { experience: body.experience }),
      ...(body.salary !== undefined && { salary: body.salary }),
      ...(body.bankName !== undefined && { bankName: body.bankName }),
      ...(body.accountNumber !== undefined && { accountNumber: body.accountNumber }),
      ...(body.ifscCode !== undefined && { ifscCode: body.ifscCode }),
      ...(body.bankBranch !== undefined && { bankBranch: body.bankBranch }),
      ...(body.accountType !== undefined && { accountType: body.accountType }),
      ...(body.roleId !== undefined && { roleId: body.roleId }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
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
  if (!user) return NextResponse.json({ error: "Recruiter not found" }, { status: 404 });

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
        { error: "Cannot delete recruiter with existing linked records. Disable the account instead." },
        { status: 409 }
      );
    }
    console.error("DELETE /api/recruiters/[id]", err);
    return NextResponse.json({ error: "Failed to delete recruiter" }, { status: 500 });
  }
}
