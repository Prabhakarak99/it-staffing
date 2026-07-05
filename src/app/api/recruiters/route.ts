import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendActivationEmail } from "@/lib/email";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });

  const recruiters = await prisma.user.findMany({
    where: recruiterRole ? { roleId: recruiterRole.id } : {},
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(recruiters);
}

async function saveBlackChequeDocument(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split(".").pop() ?? "bin";
  const safeName = `black-cheque-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "recruiters");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);
  return safeName;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, string | null> = {};
    let blackChequeDocument: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const get = (key: string) => {
        const value = formData.get(key);
        return typeof value === "string" ? value : null;
      };

      body = {
        firstName: get("firstName"),
        lastName: get("lastName"),
        email: get("email"),
        phoneNumber: get("phoneNumber"),
        businessNumber: get("businessNumber"),
        fullAddress: get("fullAddress"),
        experience: get("experience"),
        salary: get("salary"),
        bankName: get("bankName"),
        accountNumber: get("accountNumber"),
        ifscCode: get("ifscCode"),
        bankBranch: get("bankBranch"),
        accountType: get("accountType"),
        startDate: get("startDate"),
        endDate: get("endDate"),
        roleId: get("roleId"),
      };
      blackChequeDocument = await saveBlackChequeDocument((formData.get("blackChequeDocument") as File | null) ?? null);
    } else {
      const json = await req.json();
      body = {
        firstName: json.firstName ?? null,
        lastName: json.lastName ?? null,
        email: json.email ?? null,
        phoneNumber: json.phoneNumber ?? null,
        businessNumber: json.businessNumber ?? null,
        fullAddress: json.fullAddress ?? null,
        experience: json.experience ?? null,
        salary: json.salary ?? null,
        bankName: json.bankName ?? null,
        accountNumber: json.accountNumber ?? null,
        ifscCode: json.ifscCode ?? null,
        bankBranch: json.bankBranch ?? null,
        accountType: json.accountType ?? null,
        startDate: json.startDate ?? null,
        endDate: json.endDate ?? null,
        roleId: json.roleId ?? null,
      };
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      businessNumber,
      fullAddress,
      experience,
      salary,
      bankName,
      accountNumber,
      ifscCode,
      bankBranch,
      accountType,
      startDate,
      endDate,
      roleId,
    } = body;

    if (!firstName || !lastName || !email || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const activationToken = randomBytes(32).toString("hex");
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Use provided roleId or fall back to the Recruiter role
    let resolvedRoleId = roleId || null;
    if (!resolvedRoleId) {
      const recruiterRole = await prisma.role.findUnique({ where: { name: "Recruiter" } });
      resolvedRoleId = recruiterRole?.id ?? null;
    }

    const recruiter = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || null,
        businessNumber: businessNumber || null,
        fullAddress: fullAddress || null,
        experience: experience || null,
        salary: salary || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        bankBranch: bankBranch || null,
        accountType: accountType || null,
        blackChequeDocument,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        roleId: resolvedRoleId,
        isActive: false,
        password: "",
        activationToken,
        activationExpiry,
      },
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendActivationEmail(email, firstName, activationToken);
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email send failed";
      console.error("Recruiter activation email failed:", err);
    }

    return NextResponse.json({ id: recruiter.id, emailSent, emailError }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
