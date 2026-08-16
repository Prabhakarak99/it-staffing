import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-codevision-api-key");
  const expectedKey = process.env.CODEVISION_API_KEY?.trim();

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const students = await prisma.student.findMany({
    where: { email: { not: "" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      personalPhone: true,
      technology: true,
      jobTitle: true,
      projectStatus: true,
      city: true,
      state: true,
      visaStatus: true,
      workMode: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json(students);
}
