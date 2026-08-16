import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get("x-codevision-api-key");
  const expectedKey = process.env.CODEVISION_API_KEY?.trim();

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
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
  });

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  return NextResponse.json(student);
}
