import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local (the local database) wins over .env, the same way Next.js loads them
config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL!;
// Port 5433 is the tunnel to the PRODUCTION database: schema commands must never run against it from here
if (/[:@]localhost:5433\/|127\.0\.0\.1:5433\//.test(url ?? "")) {
  throw new Error("DATABASE_URL points at the production tunnel (localhost:5433). Use the local database in .env.local.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
