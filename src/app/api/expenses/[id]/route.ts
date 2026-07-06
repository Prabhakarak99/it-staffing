import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      consultant: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const formData = await req.formData();
    const get = (k: string) => (formData.get(k) as string | null) ?? "";

    const submittedById = get("submittedById");
    const category = get("category");
    const date = get("date");
    const amount = get("amount");
    const location = get("location");

    if (!submittedById) return NextResponse.json({ error: "Submitted By is required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (!amount) return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    if (!location) return NextResponse.json({ error: "Location is required" }, { status: 400 });

    let receiptFile: string | undefined;
    const file = formData.get("receiptFile") as File | null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() ?? "bin";
      const safeName = `receipt-${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "receipts");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));
      receiptFile = safeName;
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        date: new Date(date),
        submittedById,
        consultantId: get("consultantId") || null,
        category,
        description: get("description") || null,
        amount: parseFloat(amount),
        location,
        status: get("status") || "Pending",
        notes: get("notes") || null,
        ...(receiptFile ? { receiptFile } : {}),
      },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        consultant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(expense);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
