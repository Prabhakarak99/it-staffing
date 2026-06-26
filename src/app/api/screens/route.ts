import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const screens = await prisma.screen.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(screens);
}
