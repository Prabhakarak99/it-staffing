import "dotenv/config";
import { PREMARKETING_CHECKLIST_ITEMS, emptyChecklist } from "../src/lib/premarketing-checklist";
import { PROJECT_STATUSES } from "../src/lib/project-status";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

const COUNT = 35;

const ROLES = [
  "CEO",
  "POC",
  "On-Site HR",
  "Off-Shore HR",
  "Recruiter",
  "Accounts",
  "Contracts",
];

const SCREENS = [
  { name: "Onboard Recruiter", path: "/admin/recruiters" },
  { name: "Leads", path: "/admin/leads" },
  { name: "Expenses", path: "/admin/expenses" },
  { name: "User Roles", path: "/admin/userrole" },
  { name: "Onboard Students", path: "/admin/students" },
  { name: "Premarketing", path: "/admin/premarketing" },
  { name: "Submissions", path: "/admin/submissions" },
  { name: "Interviews", path: "/admin/interviews" },
  { name: "Onboard TechSupport", path: "/admin/tech-support" },
  { name: "Student Progress", path: "/admin/student-progress" },
  { name: "Users", path: "/admin/users" },
  { name: "Dashboard", path: "/admin" },
];

const TECHNOLOGIES = [
  "Java",
  "Python",
  "React",
  "Angular",
  "Node.js",
  "AWS",
  "DevOps",
  "Salesforce",
  ".NET",
  "Data Engineering",
];

const CITIES = [
  "Dallas, TX",
  "Austin, TX",
  "Atlanta, GA",
  "Charlotte, NC",
  "Chicago, IL",
  "New York, NY",
  "Remote",
];

const SUBMISSION_STATUSES = [
  "Submission Submitted",
  "Client Review",
  "Interview Scheduled",
  "Rejected",
  "On Hold",
];

const INTERVIEW_STATUSES = [
  "Scheduled",
  "Completed",
  "Cancelled",
  "No Show",
  "Rescheduled",
];

const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Lodging",
  "Software",
  "Training",
  "Equipment",
];

const EXPENSE_STATUSES = ["Pending", "Approved", "Rejected"];

const FIRST_NAMES = [
  "Ava", "Noah", "Mia", "Liam", "Emma", "Oliver", "Sophia", "Elijah",
  "Isabella", "Lucas", "Amelia", "Mason", "Harper", "Ethan", "Evelyn",
  "James", "Abigail", "Benjamin", "Emily", "Henry", "Ella", "Alexander",
  "Scarlett", "Michael", "Grace", "Daniel", "Chloe", "Matthew", "Lily",
  "Joseph", "Aria", "David", "Zoe", "Samuel", "Nora",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright",
];

const pick = <T>(items: T[], index: number) => items[index % items.length];

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

async function clearLocalData() {
  console.log("Clearing existing local data...");
  await prisma.lead.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.preMarketing.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.jobSearchResult.deleteMany();
  await prisma.techSupport.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.roleScreen.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.role.deleteMany();
}

async function seedRolesAndScreens() {
  console.log("Seeding roles and screens...");
  const roles = [];
  for (const name of ROLES) {
    roles.push(
      await prisma.role.create({
        data: { name, description: `${name} role` },
      })
    );
  }

  const screens = [];
  for (const screen of SCREENS) {
    screens.push(
      await prisma.screen.create({
        data: screen,
      })
    );
  }

  const roleScreens = [];
  for (const role of roles) {
    for (const screen of screens) {
      roleScreens.push(
        await prisma.roleScreen.create({
          data: {
            roleId: role.id,
            screenId: screen.id,
            canView: true,
          },
        })
      );
    }
  }

  return { roles, screens, roleScreens };
}

async function seedUsers(
  roles: { id: string; name: string }[],
  testPasswordHash: string,
  adminPasswordHash: string
) {
  console.log(`Seeding ${COUNT} users...`);
  const recruiterRole = roles.find((r) => r.name === "Recruiter")!;
  const users = [];

  users.push(
    await prisma.user.create({
      data: {
        firstName: "Super",
        lastName: "Admin",
        email: "admin@itstaffing.com",
        password: adminPasswordHash,
        isActive: true,
        roleId: roles.find((r) => r.name === "CEO")!.id,
        phoneNumber: "555-000-0000",
        businessNumber: "BN-000",
        startDate: daysAgo(365),
      },
    })
  );

  for (let i = 1; i < COUNT; i++) {
    const role = pick(roles, i);
    users.push(
      await prisma.user.create({
        data: {
          firstName: pick(FIRST_NAMES, i),
          lastName: pick(LAST_NAMES, i),
          email: `user${String(i).padStart(2, "0")}@test.local`,
          password: testPasswordHash,
          isActive: i % 4 !== 0,
          roleId: i % 3 === 0 ? recruiterRole.id : role.id,
          phoneNumber: `555-100-${String(i).padStart(4, "0")}`,
          businessNumber: `BN-${String(i).padStart(3, "0")}`,
          startDate: daysAgo(30 + i),
        },
      })
    );
  }

  return users;
}

async function seedStudents() {
  console.log(`Seeding ${COUNT} students...`);
  const students = [];

  for (let i = 0; i < COUNT; i++) {
    const tech = pick(TECHNOLOGIES, i);
    students.push(
      await prisma.student.create({
        data: {
          firstName: pick(FIRST_NAMES, i + 5),
          lastName: pick(LAST_NAMES, i + 7),
          email: `student${String(i + 1).padStart(2, "0")}@test.local`,
          personalPhone: `555-200-${String(i).padStart(4, "0")}`,
          phoneNumber: `555-200-${String(i).padStart(4, "0")}`,
          technology: tech,
          city: pick(CITIES, i).split(",")[0],
          state: pick(CITIES, i).includes(",") ? pick(CITIES, i).split(", ")[1] : "TX",
          zipCode: String(75000 + i),
          addressLine1: `${100 + i} Test Street`,
          universityName: `Test University ${(i % 5) + 1}`,
          universityLocation: pick(CITIES, i),
          masters: `${tech} MS`,
          visaStatus: pick(["F1", "OPT", "STEM OPT", "H1B"], i),
          visaStartDate: daysAgo(400 + i),
          visaExpiryDate: daysFromNow(200 + i),
          onboardingStartDate: daysAgo(60 + i),
          offerLetterType: pick(["W2", "C2C"], i),
          payRate: `$${55 + (i % 20)}/hr`,
          hasDL: i % 2 === 0 ? "Yes" : "No",
          hasSSN: "Yes",
          projectStatus: (() => {
            if (i < 10) return "Pre-Marketing";
            if (i < 18) return "In-Market";
            if (i < 26) return "In-Project";
            if (i < 31) return "Project Completed- InMarket";
            return pick(["Second Project", "ProjectCompleted-Exit"], i);
          })(),
          jobTitle: `${tech} Developer`,
          workMode: pick(["Remote", "Hybrid", "Onsite"], i),
          billRate: `$${70 + (i % 15)}/hr`,
          payroll: pick(["Weekly", "Bi-Weekly"], i),
          pmName: `PM ${pick(FIRST_NAMES, i)}`,
          pmEmail: `pm${i + 1}@vendor.test`,
          pmPhone: `555-300-${String(i).padStart(4, "0")}`,
          dob: daysAgo(9000 + i * 30),
        },
      })
    );
  }

  return students;
}

async function seedTechSupport() {
  console.log(`Seeding ${COUNT} tech support records...`);
  const records = [];

  for (let i = 0; i < COUNT; i++) {
    const tech = pick(TECHNOLOGIES, i);
    records.push(
      await prisma.techSupport.create({
        data: {
          firstName: pick(FIRST_NAMES, i + 11),
          lastName: pick(LAST_NAMES, i + 13),
          email: `tech${String(i + 1).padStart(2, "0")}@test.local`,
          phoneNumber: `555-400-${String(i).padStart(4, "0")}`,
          technology: tech,
          location: pick(CITIES, i),
          availability: pick(["Weekdays", "Weekends", "Evenings", "Flexible"], i),
          calendarLink: `https://cal.test/tech-${i + 1}`,
          amount: `$${40 + (i % 10)}/hr`,
        },
      })
    );
  }

  return records;
}

async function seedSubmissions(
  users: { id: string }[],
  students: { id: string; technology: string | null }[]
) {
  console.log(`Seeding ${COUNT} submissions...`);
  const recruiters = users.filter((_, index) => index > 0);
  const submissions = [];

  for (let i = 0; i < COUNT; i++) {
    const recruiter = pick(recruiters, i);
    const consultant = pick(students, i);
    submissions.push(
      await prisma.submission.create({
        data: {
          submissionId: `SUB-${String(i + 1).padStart(4, "0")}`,
          submissionDate: daysAgo(20 + i),
          recruiterId: recruiter.id,
          consultantId: consultant.id,
          technology: consultant.technology ?? pick(TECHNOLOGIES, i),
          jobDescription: `Local test submission ${i + 1} for ${consultant.technology ?? "technology"} role.`,
          payRate: `$${60 + (i % 12)}/hr`,
          vendorCompany: `Vendor ${(i % 8) + 1} LLC`,
          vendorRecruiterName: `Vendor Recruiter ${i + 1}`,
          vendorRecruiterEmail: `vendor.recruiter${i + 1}@vendor.test`,
          vendorRecruiterPhone: `555-500-${String(i).padStart(4, "0")}`,
          implementationName: `Implementation Partner ${i + 1}`,
          implementationEmail: `impl${i + 1}@partner.test`,
          implementationPhone: `555-510-${String(i).padStart(4, "0")}`,
          clientName: `Client ${(i % 6) + 1}`,
          clientLocation: pick(CITIES, i),
          status: pick(SUBMISSION_STATUSES, i),
        },
      })
    );
  }

  return submissions;
}

async function seedInterviews(
  users: { id: string }[],
  submissions: { id: string }[],
  techSupport: { id: string }[]
) {
  console.log(`Seeding ${COUNT} interviews...`);
  const recruiters = users.filter((_, index) => index > 0);
  const interviews = [];

  for (let i = 0; i < COUNT; i++) {
    const start = daysFromNow(i % 10);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    interviews.push(
      await prisma.interview.create({
        data: {
          interviewId: `INT-${String(i + 1).padStart(4, "0")}`,
          recruiterId: pick(recruiters, i).id,
          submissionId: pick(submissions, i).id,
          interviewStartDate: start,
          interviewEndDate: end,
          interviewLevel: pick(["L1", "L2", "L3", "Final"], i),
          interviewStatus: pick(INTERVIEW_STATUSES, i),
          techSupportId: pick(techSupport, i).id,
          amount: `$${45 + (i % 8) * 5}`,
          techSupportFeedback: `Tech support feedback for interview ${i + 1}`,
          otterLink: `https://otter.test/interview-${i + 1}`,
          interviewQuestions: `Sample questions set ${i + 1}`,
          interviewFeedback: `Interview feedback note ${i + 1}`,
        },
      })
    );
  }

  return interviews;
}

async function seedPreMarketing(
  students: { id: string }[],
  users: { id: string }[]
) {
  console.log("Seeding pre-marketing checklists...");
  const recruiters = users.filter((_, index) => index > 0);
  const records = [];

  for (let i = 0; i < 10; i++) {
    const checklist = emptyChecklist();
    const ratings = ["Excellent", "Good", "Average", "Bad"] as const;
    PREMARKETING_CHECKLIST_ITEMS.forEach((item, index) => {
      if (index < 8 + (i % 5)) {
        const status = ratings[index % 4];
        checklist[item.key] = {
          status,
          note: status === "Bad" || status === "Average" ? `Sample note for ${item.label}` : "",
        };
      }
    });

    records.push(
      await prisma.preMarketing.create({
        data: {
          consultantId: students[i].id,
          checklist,
          recruiterId: i % 3 === 0 ? pick(recruiters, i).id : null,
        },
      })
    );
  }

  return records;
}

async function seedLeads(
  students: { id: string; firstName: string; lastName: string; personalPhone: string | null; phoneNumber: string | null; email: string }[]
) {
  console.log("Seeding leads...");
  const records = [];

  for (let i = 0; i < 8; i++) {
    const student = students[i];
    records.push(
      await prisma.lead.create({
        data: {
          consultantName: `${student.firstName} ${student.lastName} Lead`,
          phoneNumber: student.personalPhone ?? student.phoneNumber ?? null,
          email: `lead.${student.email}`,
          comments: `Lead note ${i + 1}`,
        },
      })
    );
  }

  return records;
}

async function seedExpenses(users: { id: string }[], students: { id: string }[]) {
  console.log(`Seeding ${COUNT} expenses...`);
  const submitters = users;
  const expenses = [];

  for (let i = 0; i < COUNT; i++) {
    expenses.push(
      await prisma.expense.create({
        data: {
          expenseId: `EXP-${String(i + 1).padStart(4, "0")}`,
          date: daysAgo(5 + i),
          submittedById: pick(submitters, i).id,
          consultantId: pick(students, i).id,
          category: pick(EXPENSE_CATEGORIES, i),
          description: `Local test expense ${i + 1}`,
          amount: Number((25 + (i % 15) * 12.5).toFixed(2)),
          location: pick(CITIES, i),
          status: pick(EXPENSE_STATUSES, i),
          notes: `Expense note ${i + 1}`,
        },
      })
    );
  }

  return expenses;
}

async function seedJobSearchResults() {
  console.log(`Seeding ${COUNT} job search results...`);
  const results = [];

  for (let i = 0; i < COUNT; i++) {
    const tech = pick(TECHNOLOGIES, i);
    results.push(
      await prisma.jobSearchResult.create({
        data: {
          jobId: `JOB-${String(i + 1).padStart(4, "0")}`,
          technology: tech,
          technologies: [tech, pick(TECHNOLOGIES, i + 3)],
          source: pick(["LinkedIn", "Dice", "Indeed", "Manual"], i),
          vendorName: `Job Vendor ${(i % 7) + 1}`,
          vendorEmail: `jobs${i + 1}@vendor.test`,
          vendorPhone: `555-600-${String(i).padStart(4, "0")}`,
          location: pick(CITIES, i),
          isRemote: i % 3 === 0,
          jobDescription: `Local test job posting ${i + 1} for ${tech}.`,
          clientName: `Hiring Client ${(i % 5) + 1}`,
          jobType: pick(["Contract", "C2C", "W2"], i),
          title: `${tech} Engineer ${i + 1}`,
          datePosted: daysAgo(2 + i),
          applyLink: `https://jobs.test/apply/${i + 1}`,
          rateMin: 50 + (i % 10),
          rateMax: 70 + (i % 15),
          visaRequirements: pick([["H1B"], ["GC", "Citizen"], ["OPT", "STEM OPT"]], i),
          isActive: i % 5 !== 0,
        },
      })
    );
  }

  return results;
}

async function main() {
  console.log(`Seeding local test database with ${COUNT}+ records per entity...\n`);

  await clearLocalData();

  const adminPasswordHash = await bcrypt.hash("Admin@1234", 12);
  const testPasswordHash = await bcrypt.hash("Test@1234", 12);
  const { roles, screens, roleScreens } = await seedRolesAndScreens();
  const users = await seedUsers(roles, testPasswordHash, adminPasswordHash);
  const students = await seedStudents();
  const techSupport = await seedTechSupport();
  const submissions = await seedSubmissions(users, students);
  const interviews = await seedInterviews(users, submissions, techSupport);
  const preMarketings = await seedPreMarketing(students, users);
  const leads = await seedLeads(students);
  const expenses = await seedExpenses(users, students);
  const jobSearchResults = await seedJobSearchResults();

  console.log("\nLocal seed complete:");
  console.log(`  Roles:            ${roles.length}`);
  console.log(`  Screens:          ${screens.length}`);
  console.log(`  Role screens:     ${roleScreens.length}`);
  console.log(`  Users:            ${users.length}`);
  console.log(`  Students:         ${students.length}`);
  console.log(`  Tech support:     ${techSupport.length}`);
  console.log(`  Submissions:      ${submissions.length}`);
  console.log(`  Interviews:       ${interviews.length}`);
  console.log(`  Pre-marketing:    ${preMarketings.length}`);
  console.log(`  Leads:            ${leads.length}`);
  console.log(`  Expenses:         ${expenses.length}`);
  console.log(`  Job search jobs:  ${jobSearchResults.length}`);
  console.log("\nLogin credentials:");
  console.log("  admin@itstaffing.com / Admin@1234");
  console.log("  user01@test.local ... user34@test.local / Test@1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
