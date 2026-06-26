import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  await prisma.screen.deleteMany({ where: { name: "Onboarding" } });
  const result = await prisma.screen.upsert({
    where: { name: "Onboard TechSupport" },
    update: { path: "/admin/tech-support" },
    create: { name: "Onboard TechSupport", path: "/admin/tech-support" },
  });
  console.log("Screen updated:", result.name, "->", result.path);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
