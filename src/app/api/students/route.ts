import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isCodeVisionConfigured, provisionCodeVisionStudent } from "@/lib/codevision";
import { writeFile } from "fs/promises";
import path from "path";
import { emptyChecklist, replaceConsultantLevelComments } from "@/lib/premarketing-checklist";
import { parseDateInput } from "@/lib/dates";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();

    const get = (key: string) => (formData.get(key) as string | null) ?? undefined;

    const firstName = get("firstName") ?? "";
    const lastName = get("lastName") ?? "";
    const email = get("email") ?? "";

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "First name, last name, and email are required" }, { status: 400 });
    }

    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A consultant with this email already exists" }, { status: 409 });
    }

    // Handle file uploads
    async function saveFile(field: string): Promise<string | undefined> {
      const file = formData.get(field) as File | null;
      if (!file || file.size === 0) return undefined;
      const ext = file.name.split(".").pop() ?? "bin";
      const safeName = `${field}-${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
      await writeFile(path.join(uploadDir, safeName), buffer);
      return safeName;
    }

    const [dlDocument, passportDocument, visaCopyDocument] = await Promise.all([
      saveFile("dlDocument"),
      saveFile("passportDocument"),
      saveFile("visaCopyDocument"),
    ]);

    const dob = get("dob") ? parseDateInput(get("dob")!) : undefined;
    const visaStartDate = get("visaStartDate") ? parseDateInput(get("visaStartDate")!) : undefined;
    const visaExpiryDate = get("visaExpiryDate") ? parseDateInput(get("visaExpiryDate")!) : undefined;
    const onboardingStartDate = get("onboardingStartDate") ? parseDateInput(get("onboardingStartDate")!) : undefined;
    const verbalConfirmationDate = get("verbalConfirmationDate") ? parseDateInput(get("verbalConfirmationDate")!) : undefined;
    const projectStartDate = get("projectStartDate") ? parseDateInput(get("projectStartDate")!) : undefined;

    const projectStatus = get("projectStatus");
    const consultantComment = get("consultantComment") ?? "";

    if (projectStatus === "Verbal Confirmation" && !get("verbalConfirmationDate")) {
      return NextResponse.json({ error: "Verbal confirmation date is required for Verbal Confirmation status" }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        email,
        personalPhone: get("personalPhone"),
        dob,
        parentPhone: get("parentPhone"),
        emergencyContact: get("emergencyContact"),
        referredBy: get("referredBy"),
        addressLine1: get("addressLine1"),
        addressLine2: get("addressLine2"),
        city: get("city"),
        state: get("state"),
        zipCode: get("zipCode"),
        universityName: get("universityName"),
        universityLocation: get("universityLocation"),
        masters: get("masters"),
        mastersCompletedDate: get("mastersCompletedDate"),
        dsoName: get("dsoName"),
        dsoEmail: get("dsoEmail"),
        dsoPhone: get("dsoPhone"),
        visaStatus: get("visaStatus"),
        visaStartDate,
        visaExpiryDate,
        onboardingStartDate,
        offerLetterType: get("offerLetterType"),
        payRate: get("payRate"),
        hasDL: get("hasDL"),
        hasSSN: get("hasSSN"),
        passportNumber: get("passportNumber"),
        dlDocument: dlDocument ?? null,
        passportDocument: passportDocument ?? null,
        visaCopyDocument: visaCopyDocument ?? null,
        projectStatus: projectStatus ?? null,
        jobTitle: get("jobTitle"),
        verbalConfirmationDate,
        linkedInterviewId: get("linkedInterviewId"),
        projectStartDate,
        billRate: get("billRate"),
        payroll: get("payroll"),
        workMode: get("workMode"),
        pmName: get("pmName"),
        pmEmail: get("pmEmail"),
        pmPhone: get("pmPhone"),
        driveLocation: get("driveLocation"),
        technology: get("technology"),
        comments: replaceConsultantLevelComments([], consultantComment),
      },
    });

    if (projectStatus === "Pre-Marketing") {
      await prisma.preMarketing.create({
        data: { consultantId: student.id, checklist: emptyChecklist() },
      });
    }

    let codeVisionProvisioned = false;
    let codeVisionEmailSent = false;
    let codeVisionActivationUrl: string | null = null;
    let codeVisionError: string | null = null;

    if (isCodeVisionConfigured()) {
      try {
        const codeVisionResult = await provisionCodeVisionStudent({
          externalStudentId: student.id,
          email: student.email,
          phoneNumber: student.personalPhone,
          technology: student.technology,
          name: `${student.firstName} ${student.lastName}`.trim(),
        });
        codeVisionProvisioned = true;
        codeVisionEmailSent = codeVisionResult.emailSent;
        codeVisionActivationUrl = codeVisionResult.activationUrl;
      } catch (err) {
        codeVisionError = err instanceof Error ? err.message : "CodeVision provisioning failed";
        console.error("CodeVision student provisioning failed:", err);
      }
    }

    return NextResponse.json(
      {
        ...student,
        codeVisionProvisioned,
        codeVisionEmailSent,
        codeVisionActivationUrl,
        codeVisionError,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
