import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // "john sm" matches John Smith: every word must hit the first name, last name or email (any case)
  const words = q.split(/\s+/).filter(Boolean);

  // Every consultant is searchable by every recruiter, whoever they are assigned to
  const students = await prisma.student.findMany({
    where: words.length
      ? {
          AND: words.map((w) => ({
            OR: [
              { firstName: { contains: w, mode: "insensitive" as const } },
              { lastName: { contains: w, mode: "insensitive" as const } },
              { email: { contains: w, mode: "insensitive" as const } },
            ],
          })),
        }
      : undefined,
    select: { id: true, firstName: true, lastName: true, email: true, technology: true, personalPhone: true, phoneNumber: true },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  return NextResponse.json(students);
}
