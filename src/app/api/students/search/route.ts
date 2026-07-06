import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";

  const students = await prisma.student.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    select: { id: true, firstName: true, lastName: true, email: true, technology: true, personalPhone: true, phoneNumber: true },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  return NextResponse.json(students);
}
