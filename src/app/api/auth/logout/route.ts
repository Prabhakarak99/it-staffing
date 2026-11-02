import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

export async function POST() {
  await deleteSession();
  // Relative Location keeps the user on the current host/port; 303 makes the browser follow with GET
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
