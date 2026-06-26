import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const roleScreens = await prisma.roleScreen.findMany();
  return NextResponse.json(roleScreens);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assignments } = await req.json() as {
    assignments: { roleId: string; screenId: string; canView: boolean }[];
  };

  // Upsert all assignments in one transaction
  await prisma.$transaction(
    assignments.map(({ roleId, screenId, canView }) =>
      prisma.roleScreen.upsert({
        where: { roleId_screenId: { roleId, screenId } },
        create: { roleId, screenId, canView },
        update: { canView },
      })
    )
  );

  return NextResponse.json({ success: true });
}
