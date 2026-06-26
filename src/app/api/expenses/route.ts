import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function getNextExpenseId(): Promise<string> {
  const last = await prisma.expense.findFirst({ orderBy: { createdAt: "desc" } });
  if (!last) return "EXP-001";
  const num = parseInt(last.expenseId.replace("EXP-", ""), 10);
  return `EXP-${String(num + 1).padStart(3, "0")}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expenses = await prisma.expense.findMany({
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      consultant: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Handle receipt upload
    let receiptFile: string | null = null;
    const file = formData.get("receiptFile") as File | null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() ?? "bin";
      const safeName = `receipt-${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "receipts");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));
      receiptFile = safeName;
    }

    const expenseId = await getNextExpenseId();

    const expense = await prisma.expense.create({
      data: {
        expenseId,
        date: new Date(date),
        submittedById,
        consultantId: get("consultantId") || null,
        category,
        description: get("description") || null,
        amount: parseFloat(amount),
        location,
        receiptFile,
        status: get("status") || "Pending",
        notes: get("notes") || null,
      },
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
