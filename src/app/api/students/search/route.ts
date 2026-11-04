import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { personSearchWhere } from "@/lib/search";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Every consultant is searchable by every recruiter, whoever they are assigned to
  const students = await prisma.student.findMany({
    where: personSearchWhere(req.nextUrl.searchParams.get("q")),
    select: { id: true, firstName: true, lastName: true, email: true, technology: true, personalPhone: true, phoneNumber: true },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  return NextResponse.json(students);
}
