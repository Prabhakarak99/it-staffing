import { NextRequest, NextResponse } from "next/server";
import { emptyChecklist, replaceConsultantLevelComments } from "@/lib/premarketing-checklist";
import { parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        preMarketings: {
          select: {
            marketingVisaStatus: true,
            recruiterId: true,
            recruiter: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!student) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });
    const { preMarketings, ...consultant } = student;
    const pm = preMarketings[0];
    return NextResponse.json({
      ...consultant,
      marketingVisaStatus: pm?.marketingVisaStatus ?? null,
      assignedRecruiterId: pm?.recruiterId ?? null,
      assignedRecruiterName: pm?.recruiter
        ? `${pm.recruiter.firstName} ${pm.recruiter.lastName}`.trim()
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch consultant" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });

    const formData = await req.formData();
    const get = (key: string) => (formData.get(key) as string | null) ?? undefined;

    const firstName = get("firstName") ?? "";
    const lastName = get("lastName") ?? "";
    const email = get("email") ?? "";

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "First name, last name, and email are required" }, { status: 400 });
    }

    const emailTaken = await prisma.student.findFirst({
      where: { email, NOT: { id } },
    });
    if (emailTaken) {
      return NextResponse.json({ error: "A consultant with this email already exists" }, { status: 409 });
    }

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

    const dob = get("dob") ? parseDateInput(get("dob")!) : null;
    const visaStartDate = get("visaStartDate") ? parseDateInput(get("visaStartDate")!) : null;
    const visaExpiryDate = get("visaExpiryDate") ? parseDateInput(get("visaExpiryDate")!) : null;
    const onboardingStartDate = get("onboardingStartDate") ? parseDateInput(get("onboardingStartDate")!) : null;
    const verbalConfirmationDate = get("verbalConfirmationDate") ? parseDateInput(get("verbalConfirmationDate")!) : null;
    const projectStartDate = get("projectStartDate") ? parseDateInput(get("projectStartDate")!) : null;

    const projectStatus = get("projectStatus") ?? null;
    const consultantComment = get("consultantComment") ?? "";
    const marketingVisaStatus = get("marketingVisaStatus") || null;
    const hasRecruiterId = formData.has("recruiterId");
    const recruiterId = hasRecruiterId ? (get("recruiterId") || null) : undefined;

    if (projectStatus === "Verbal Confirmation" && !get("verbalConfirmationDate")) {
      return NextResponse.json({ error: "Verbal confirmation date is required for Verbal Confirmation status" }, { status: 400 });
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        personalPhone: get("personalPhone") ?? null,
        dob,
        parentPhone: get("parentPhone") ?? null,
        emergencyContact: get("emergencyContact") ?? null,
        referredBy: get("referredBy") ?? null,
        addressLine1: get("addressLine1") ?? null,
        addressLine2: get("addressLine2") ?? null,
        city: get("city") ?? null,
        state: get("state") ?? null,
        zipCode: get("zipCode") ?? null,
        universityName: get("universityName") ?? null,
        universityLocation: get("universityLocation") ?? null,
        masters: get("masters") ?? null,
        mastersCompletedDate: get("mastersCompletedDate") ?? null,
        dsoName: get("dsoName") ?? null,
        dsoEmail: get("dsoEmail") ?? null,
        dsoPhone: get("dsoPhone") ?? null,
        visaStatus: get("visaStatus") ?? null,
        visaStartDate,
        visaExpiryDate,
        onboardingStartDate,
        offerLetterType: get("offerLetterType") ?? null,
        payRate: get("payRate") ?? null,
        hasDL: get("hasDL") ?? null,
        hasSSN: get("hasSSN") ?? null,
        passportNumber: get("passportNumber") ?? null,
        dlDocument: dlDocument ?? existing.dlDocument,
        passportDocument: passportDocument ?? existing.passportDocument,
        visaCopyDocument: visaCopyDocument ?? existing.visaCopyDocument,
        projectStatus,
        jobTitle: get("jobTitle") ?? null,
        verbalConfirmationDate,
        linkedInterviewId: get("linkedInterviewId") ?? null,
        projectStartDate,
        billRate: get("billRate") ?? null,
        payroll: get("payroll") ?? null,
        workMode: get("workMode") ?? null,
        pmName: get("pmName") ?? null,
        pmEmail: get("pmEmail") ?? null,
        pmPhone: get("pmPhone") ?? null,
        driveLocation: get("driveLocation") ?? null,
        technology: get("technology") ?? null,
        comments: replaceConsultantLevelComments(existing.comments, consultantComment),
      },
    });

    const existingPm = await prisma.preMarketing.findFirst({ where: { consultantId: id } });
    if (existingPm) {
      await prisma.preMarketing.update({
        where: { id: existingPm.id },
        data: {
          marketingVisaStatus,
          ...(recruiterId !== undefined ? { recruiterId } : {}),
        },
      });
    } else if (projectStatus === "Pre-Marketing" || marketingVisaStatus || recruiterId) {
      await prisma.preMarketing.create({
        data: {
          consultantId: id,
          checklist: emptyChecklist(),
          marketingVisaStatus,
          recruiterId: recruiterId ?? null,
        },
      });
    }

    return NextResponse.json(student);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update consultant" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const submissions = await tx.submission.findMany({
        where: { consultantId: id },
        select: { id: true },
      });
      const submissionIds = submissions.map((s) => s.id);

      if (submissionIds.length > 0) {
        await tx.interview.deleteMany({ where: { submissionId: { in: submissionIds } } });
        await tx.submission.deleteMany({ where: { consultantId: id } });
      }

      await tx.preMarketing.deleteMany({ where: { consultantId: id } });
      await tx.expense.updateMany({ where: { consultantId: id }, data: { consultantId: null } });
      await tx.student.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete consultant" }, { status: 500 });
  }
}
