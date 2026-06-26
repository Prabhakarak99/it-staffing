import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbUrl = `file:${path.resolve(__dirname, "../dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

try {
  // Delete old record if exists
  await prisma.screen.deleteMany({ where: { name: "Onboarding" } });
  // Upsert new record
  const result = await prisma.screen.upsert({
    where: { name: "Onboard TechSupport" },
    update: { path: "/admin/tech-support" },
    create: { name: "Onboard TechSupport", path: "/admin/tech-support" },
  });
  console.log("Screen updated:", result.name, "->", result.path);
} finally {
  await prisma.$disconnect();
}
