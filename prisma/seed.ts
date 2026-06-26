import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
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
