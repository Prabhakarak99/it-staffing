import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.techSupport.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { firstName, lastName, email, phoneNumber, technology, location, availability, calendarLink, amount } = body;

    if (!firstName || !lastName || !email || !phoneNumber || !technology || !location) {
      return NextResponse.json({ error: "Name, email, phone, technology and location are required" }, { status: 400 });
    }

    const existing = await prisma.techSupport.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A tech support person with this email already exists" }, { status: 409 });
    }

    const person = await prisma.techSupport.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber,
        technology,
        location,
        availability: availability || null,
        calendarLink: calendarLink || null,
        amount: amount || null,
      },
    });

    return NextResponse.json(person, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
