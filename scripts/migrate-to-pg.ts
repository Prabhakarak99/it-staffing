/**
 * Migration script: SQLite → PostgreSQL
 * Usage:
 *   1. Download prod DB: fly sftp get /data/dev.db prod-backup.db -a gftvision
 *   2. Start proxy:      fly pg proxy gftvision-pg --local-port 15432
 *   3. Run:              $env:DATABASE_URL="postgres://gftvision:Q8OysFiRQTNCAQ7@localhost:15432/gftvision?sslmode=disable"
 *                        npx tsx scripts/migrate-to-pg.ts
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

const SQLITE_PATH = path.resolve(process.cwd(), "prod-backup.db");

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const pg = new PrismaClient({ adapter } as never);

function rows<T>(sql: string): T[] {
  return sqlite.prepare(sql).all() as T[];
}

async function main() {
  console.log("Starting migration from SQLite →  PostgreSQL...\n");

  // Clear existing seeded data (reverse dependency order)
  console.log("Clearing existing data...");
  await pg.expense.deleteMany();
  await pg.preMarketing.deleteMany();
  await pg.interview.deleteMany();
  await pg.submission.deleteMany();
  await pg.techSupport.deleteMany();
  await pg.student.deleteMany();
  await pg.user.deleteMany();
  await pg.roleScreen.deleteMany();
  await pg.screen.deleteMany();
  await pg.role.deleteMany();
  console.log("Done. Inserting SQLite data...\n");

  // ── Roles ────────────────────────────────────────────────────────────────
  const roles = rows<{ id: string; name: string; description: string | null; createdAt: string; updatedAt: string }>(
    "SELECT * FROM Role"
  );
  console.log(`Migrating ${roles.length} roles...`);
  for (const r of roles) {
    await pg.role.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        description: r.description,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      },
    });
  }

  // ── Screens ──────────────────────────────────────────────────────────────
  const screens = rows<{ id: string; name: string; path: string; description: string | null }>(
    "SELECT * FROM Screen"
  );
  console.log(`Migrating ${screens.length} screens...`);
  for (const s of screens) {
    await pg.screen.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, name: s.name, path: s.path, description: s.description },
    });
  }

  // ── RoleScreens ──────────────────────────────────────────────────────────
  const roleScreens = rows<{ id: string; roleId: string; screenId: string; canView: number }>(
    "SELECT * FROM RoleScreen"
  );
  console.log(`Migrating ${roleScreens.length} role-screen mappings...`);
  for (const rs of roleScreens) {
    await pg.roleScreen.upsert({
      where: { id: rs.id },
      update: {},
      create: {
        id: rs.id,
        roleId: rs.roleId,
        screenId: rs.screenId,
        canView: rs.canView === 1,
      },
    });
  }

  // ── Users ────────────────────────────────────────────────────────────────
  const users = rows<{
    id: string; firstName: string; lastName: string; email: string;
    phoneNumber: string | null; password: string; roleId: string | null;
    isActive: number; activationToken: string | null; activationExpiry: string | null;
    businessNumber: string | null; startDate: string | null; endDate: string | null;
    createdAt: string; updatedAt: string;
  }>("SELECT * FROM User");
  console.log(`Migrating ${users.length} users...`);
  for (const u of users) {
    await pg.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phoneNumber: u.phoneNumber,
        password: u.password,
        roleId: u.roleId,
        isActive: u.isActive === 1,
        activationToken: u.activationToken,
        activationExpiry: u.activationExpiry ? new Date(u.activationExpiry) : null,
        businessNumber: u.businessNumber,
        startDate: u.startDate ? new Date(u.startDate) : null,
        endDate: u.endDate ? new Date(u.endDate) : null,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    });
  }

  // ── Students ─────────────────────────────────────────────────────────────
  const students = rows<Record<string, unknown>>("SELECT * FROM Student");
  console.log(`Migrating ${students.length} students...`);
  for (const s of students) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.student.upsert({
      where: { id: str(s.id)! },
      update: {},
      create: {
        id: str(s.id)!,
        firstName: str(s.firstName)!,
        lastName: str(s.lastName)!,
        email: str(s.email)!,
        personalPhone: str(s.personalPhone),
        dob: dt(s.dob),
        parentPhone: str(s.parentPhone),
        emergencyContact: str(s.emergencyContact),
        referredBy: str(s.referredBy),
        addressLine1: str(s.addressLine1),
        addressLine2: str(s.addressLine2),
        city: str(s.city),
        state: str(s.state),
        zipCode: str(s.zipCode),
        universityName: str(s.universityName),
        universityLocation: str(s.universityLocation),
        masters: str(s.masters),
        mastersCompletedDate: str(s.mastersCompletedDate),
        dsoName: str(s.dsoName),
        dsoEmail: str(s.dsoEmail),
        dsoPhone: str(s.dsoPhone),
        visaStatus: str(s.visaStatus),
        visaStartDate: dt(s.visaStartDate),
        visaExpiryDate: dt(s.visaExpiryDate),
        onboardingStartDate: dt(s.onboardingStartDate),
        offerLetterType: str(s.offerLetterType),
        payRate: str(s.payRate),
        hasDL: str(s.hasDL),
        hasSSN: str(s.hasSSN),
        passportNumber: str(s.passportNumber),
        dlDocument: str(s.dlDocument),
        passportDocument: str(s.passportDocument),
        visaCopyDocument: str(s.visaCopyDocument),
        projectStatus: str(s.projectStatus),
        jobTitle: str(s.jobTitle),
        verbalConfirmationDate: dt(s.verbalConfirmationDate),
        linkedInterviewId: str(s.linkedInterviewId),
        projectStartDate: dt(s.projectStartDate),
        billRate: str(s.billRate),
        payroll: str(s.payroll),
        workMode: str(s.workMode),
        pmName: str(s.pmName),
        pmEmail: str(s.pmEmail),
        pmPhone: str(s.pmPhone),
        phoneNumber: str(s.phoneNumber),
        technology: str(s.technology),
        createdAt: dt(s.createdAt) ?? new Date(),
        updatedAt: dt(s.updatedAt) ?? new Date(),
      },
    });
  }

  // ── TechSupport ──────────────────────────────────────────────────────────
  const techSupports = rows<Record<string, unknown>>("SELECT * FROM TechSupport");
  console.log(`Migrating ${techSupports.length} tech support records...`);
  for (const t of techSupports) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.techSupport.upsert({
      where: { id: str(t.id)! },
      update: {},
      create: {
        id: str(t.id)!,
        firstName: str(t.firstName)!,
        lastName: str(t.lastName)!,
        email: str(t.email)!,
        phoneNumber: str(t.phoneNumber)!,
        technology: str(t.technology)!,
        location: str(t.location)!,
        availability: str(t.availability),
        calendarLink: str(t.calendarLink),
        amount: str(t.amount),
        createdAt: dt(t.createdAt) ?? new Date(),
        updatedAt: dt(t.updatedAt) ?? new Date(),
      },
    });
  }

  // ── Submissions ──────────────────────────────────────────────────────────
  const submissions = rows<Record<string, unknown>>("SELECT * FROM Submission");
  console.log(`Migrating ${submissions.length} submissions...`);
  for (const s of submissions) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.submission.upsert({
      where: { id: str(s.id)! },
      update: {},
      create: {
        id: str(s.id)!,
        submissionId: str(s.submissionId)!,
        submissionDate: dt(s.submissionDate)!,
        recruiterId: str(s.recruiterId)!,
        consultantId: str(s.consultantId)!,
        technology: str(s.technology)!,
        jobDescription: str(s.jobDescription),
        payRate: str(s.payRate),
        vendorCompany: str(s.vendorCompany)!,
        vendorRecruiterName: str(s.vendorRecruiterName)!,
        vendorRecruiterEmail: str(s.vendorRecruiterEmail)!,
        vendorRecruiterPhone: str(s.vendorRecruiterPhone)!,
        implementationName: str(s.implementationName),
        implementationEmail: str(s.implementationEmail),
        implementationPhone: str(s.implementationPhone),
        clientName: str(s.clientName),
        clientLocation: str(s.clientLocation),
        status: str(s.status) ?? "Submission Submitted",
        createdAt: dt(s.createdAt) ?? new Date(),
        updatedAt: dt(s.updatedAt) ?? new Date(),
      },
    });
  }

  // ── Interviews ───────────────────────────────────────────────────────────
  const interviews = rows<Record<string, unknown>>("SELECT * FROM Interview");
  console.log(`Migrating ${interviews.length} interviews...`);
  for (const i of interviews) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.interview.upsert({
      where: { id: str(i.id)! },
      update: {},
      create: {
        id: str(i.id)!,
        interviewId: str(i.interviewId)!,
        recruiterId: str(i.recruiterId)!,
        submissionId: str(i.submissionId)!,
        interviewStartDate: dt(i.interviewStartDate)!,
        interviewEndDate: dt(i.interviewEndDate)!,
        interviewLevel: str(i.interviewLevel)!,
        interviewStatus: str(i.interviewStatus)!,
        techSupportId: str(i.techSupportId),
        amount: str(i.amount),
        techSupportFeedback: str(i.techSupportFeedback),
        otterLink: str(i.otterLink),
        interviewQuestions: str(i.interviewQuestions),
        interviewFeedback: str(i.interviewFeedback),
        createdAt: dt(i.createdAt) ?? new Date(),
        updatedAt: dt(i.updatedAt) ?? new Date(),
      },
    });
  }

  // ── PreMarketing ─────────────────────────────────────────────────────────
  const preMarketings = rows<Record<string, unknown>>("SELECT * FROM PreMarketing");
  console.log(`Migrating ${preMarketings.length} pre-marketing records...`);
  for (const p of preMarketings) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.preMarketing.upsert({
      where: { id: str(p.id)! },
      update: {},
      create: {
        id: str(p.id)!,
        consultantId: str(p.consultantId)!,
        dlAvailable: str(p.dlAvailable),
        visaAvailable: str(p.visaAvailable),
        ssnAvailable: str(p.ssnAvailable),
        marketingSheetReady: str(p.marketingSheetReady),
        marketingSheetExplained: str(p.marketingSheetExplained),
        marketingSheetReverseKT: str(p.marketingSheetReverseKT),
        allTrainingSessionsCompleted: str(p.allTrainingSessionsCompleted),
        allTrainingAssignmentsCompleted: str(p.allTrainingAssignmentsCompleted),
        marketingEmail: str(p.marketingEmail),
        marketingVisaStatus: str(p.marketingVisaStatus),
        marketingStartDate: dt(p.marketingStartDate),
        marketingEndDate: dt(p.marketingEndDate),
        recruiterId: str(p.recruiterId),
        createdAt: dt(p.createdAt) ?? new Date(),
        updatedAt: dt(p.updatedAt) ?? new Date(),
      },
    });
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  const expenses = rows<Record<string, unknown>>("SELECT * FROM Expense");
  console.log(`Migrating ${expenses.length} expenses...`);
  for (const e of expenses) {
    const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const dt = (v: unknown) => (v ? new Date(String(v)) : null);
    await pg.expense.upsert({
      where: { id: str(e.id)! },
      update: {},
      create: {
        id: str(e.id)!,
        expenseId: str(e.expenseId)!,
        date: dt(e.date)!,
        submittedById: str(e.submittedById)!,
        consultantId: str(e.consultantId),
        category: str(e.category)!,
        description: str(e.description),
        amount: Number(e.amount),
        location: str(e.location)!,
        receiptFile: str(e.receiptFile),
        status: str(e.status) ?? "Pending",
        notes: str(e.notes),
        createdAt: dt(e.createdAt) ?? new Date(),
        updatedAt: dt(e.updatedAt) ?? new Date(),
      },
    });
  }

  console.log("\n✓ Migration complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { sqlite.close(); await pg.$disconnect(); });
