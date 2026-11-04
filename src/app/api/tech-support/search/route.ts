import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { personSearchWhere } from "@/lib/search";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await prisma.techSupport.findMany({
    where: personSearchWhere(req.nextUrl.searchParams.get("q")),
    select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, technology: true, location: true, availability: true, amount: true },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  return NextResponse.json(results);
}
