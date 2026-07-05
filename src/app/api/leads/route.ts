import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { consultantName, phoneNumber, email, comments } = body as {
      consultantName?: string;
      phoneNumber?: string;
      email?: string;
      comments?: string;
    };

    if (!consultantName?.trim()) {
      return NextResponse.json({ error: "Consultant name is required" }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        consultantName: consultantName.trim(),
        phoneNumber: phoneNumber?.trim() || null,
        email: email.trim(),
        comments: comments?.trim() || null,
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
