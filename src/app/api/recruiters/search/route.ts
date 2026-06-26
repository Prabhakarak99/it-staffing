import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";

  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const recruiters = await prisma.user.findMany({
    where: {
      ...(recruiterRole ? { roleId: recruiterRole.id } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  return NextResponse.json(recruiters);
}
