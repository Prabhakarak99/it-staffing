import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const rawUrl = process.env.DATABASE_URL ?? `file:${path.resolve(process.cwd(), "dev.db")}`;

// Resolve file: URL to absolute path for better-sqlite3
const dbPath = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
const adapter = new PrismaBetterSqlite3({ url: `file:${path.resolve(dbPath)}` });
const prisma = new PrismaClient({ adapter } as never);

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

async function main() {
  console.log("Seeding roles...");
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seeding screens...");
  for (const screen of SCREENS) {
    await prisma.screen.upsert({
      where: { name: screen.name },
      update: { path: screen.path },
      create: screen,
    });
  }

  console.log("Creating Super Admin user...");
  const existing = await prisma.user.findUnique({
    where: { email: "admin@itstaffing.com" },
  });

  if (!existing) {
    const hashed = await bcrypt.hash("Admin@1234", 12);
    await prisma.user.create({
      data: {
        firstName: "Super",
        lastName: "Admin",
        email: "admin@itstaffing.com",
        password: hashed,
        isActive: true,
      },
    });
    console.log("Super Admin created: admin@itstaffing.com / Admin@1234");
  } else {
    console.log("Super Admin already exists.");
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
