/**
 * Copies the single-company database (today's GenFusion data) into the new multi-company database.
 *
 *   SOURCE_DATABASE_URL  the old database: opened READ ONLY, never changed
 *   TARGET_DATABASE_URL  the new, empty database (schema from prisma/migrations already applied)
 *   PLATFORM_ADMIN_EMAIL optional: this user also becomes the Platform Super Admin
 *
 *   npx tsx scripts/copy-to-multi-company.ts
 *
 * Every row goes to the company "GenFusion Tech" (slug genfusiontech, code GEN), except the shared
 * job feed and default keys, which go to the hidden "platform" company. Submission ids Sub-NNN become
 * Sub-GEN-NNN. Ends with a row-count comparison per table; any difference makes it fail.
 */
import { Client } from "pg";

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() || null;

export const PLATFORM = { id: "platform", slug: "platform", code: "PLT", name: "Platform", kind: "platform" };
export const GENFUSION = { id: "co_genfusiontech", slug: "genfusiontech", code: "GEN", name: "GenFusion Tech", kind: "company" };

/** Shared for every company: the job feed and the default keys */
const PLATFORM_TABLES = new Set(["job_search_results", "job_api_sources", "AtsCompany", "JobIngestConfig", "AiProvider", "GmailSettings"]);
/** No company at all */
const GLOBAL_TABLES = new Set(["Screen", "DailyQuote", "AppMigration"]);
const SKIP = new Set(["_prisma_migrations", "Company"]);
const BATCH = 200;

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Row changes that go with the move */
function transform(table: string, row: Record<string, unknown>) {
  if (table === "Submission" && typeof row.submissionId === "string") {
    row.submissionId = row.submissionId.replace(/^Sub-(\d+)$/, `Sub-${GENFUSION.code}-$1`);
  }
  if (table === "job_api_sources") row.provider = row.id; // the id was the provider name
  if (table === "User") row.isPlatformAdmin = !!ADMIN_EMAIL && String(row.email).trim().toLowerCase() === ADMIN_EMAIL;
  return row;
}

async function main() {
  if (!SOURCE || !TARGET) throw new Error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL");
  if (SOURCE === TARGET) throw new Error("Source and target are the same database");

  const src = new Client({ connectionString: SOURCE });
  const dst = new Client({ connectionString: TARGET });
  await src.connect();
  await dst.connect();

  // The source is read in one read-only snapshot: nothing can be written to it
  await src.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const existing = await dst.query(`SELECT count(*)::int AS n FROM "Company"`);
  if (existing.rows[0].n > 0) throw new Error("The target database already has companies. Copy only into a new, empty database.");

  const tables = async (c: Client) =>
    (await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).rows.map((r) => r.table_name as string);
  const columns = async (c: Client, table: string) =>
    (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])).rows as { column_name: string; data_type: string }[];

  const srcTables = new Set(await tables(src));
  const report: { table: string; source: number; target: number }[] = [];

  await dst.query("BEGIN");
  // Rows go in table by table; the source already satisfied every foreign key, so checks wait until the end
  await dst.query("SET session_replication_role = replica");
  for (const c of [PLATFORM, GENFUSION]) {
    await dst.query(`INSERT INTO "Company"(id, slug, code, name, kind, "updatedAt") VALUES ($1, $2, $3, $4, $5, now())`, [c.id, c.slug, c.code, c.name, c.kind]);
  }

  for (const table of (await tables(dst)).sort()) {
    if (SKIP.has(table)) continue;
    if (!srcTables.has(table)) {
      console.warn(`- ${table}: not in the source, left empty`);
      continue;
    }
    const tCols = await columns(dst, table);
    const sNames = new Set((await columns(src, table)).map((c) => c.column_name));
    const companyId = GLOBAL_TABLES.has(table) ? null : PLATFORM_TABLES.has(table) ? PLATFORM.id : GENFUSION.id;
    const extra = new Set(["companyId", "provider", "isPlatformAdmin"]);
    const cols = tCols.filter((c) => sNames.has(c.column_name) || (extra.has(c.column_name) && (c.column_name !== "companyId" || companyId)));
    const json = new Set(tCols.filter((c) => c.data_type === "json" || c.data_type === "jsonb").map((c) => c.column_name));
    const readCols = cols.filter((c) => sNames.has(c.column_name)).map((c) => q(c.column_name));

    const { rows } = await src.query(`SELECT ${readCols.join(", ")} FROM ${q(table)}`);
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values: unknown[] = [];
      const tuples = chunk.map((raw) => {
        const row = transform(table, { ...raw, companyId });
        return `(${cols
          .map((c) => {
            const v = row[c.column_name];
            values.push(json.has(c.column_name) && v !== null && v !== undefined ? JSON.stringify(v) : v);
            return `$${values.length}`;
          })
          .join(", ")})`;
      });
      await dst.query(`INSERT INTO ${q(table)} (${cols.map((c) => q(c.column_name)).join(", ")}) VALUES ${tuples.join(", ")}`, values);
    }
    const target = (await dst.query(`SELECT count(*)::int AS n FROM ${q(table)}`)).rows[0].n as number;
    report.push({ table, source: rows.length, target });
  }

  await dst.query("SET session_replication_role = DEFAULT");
  const bad = report.filter((r) => r.source !== r.target);
  if (bad.length) {
    await dst.query("ROLLBACK");
    console.table(report);
    throw new Error(`Row counts differ in: ${bad.map((b) => b.table).join(", ")}. Nothing was saved.`);
  }

  // Foreign keys were not checked during the copy: check every one now (rows pointing at nothing)
  const fks = (
    await dst.query(`
      SELECT c.conname, cl.relname AS child, a.attname AS col, pcl.relname AS parent, pa.attname AS pcol
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_class pcl ON pcl.oid = c.confrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`)
  ).rows as { conname: string; child: string; col: string; parent: string; pcol: string }[];
  const orphans: string[] = [];
  for (const fk of fks) {
    const n = (
      await dst.query(
        `SELECT count(*)::int AS n FROM ${q(fk.child)} c WHERE c.${q(fk.col)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${q(fk.parent)} p WHERE p.${q(fk.pcol)} = c.${q(fk.col)})`,
      )
    ).rows[0].n as number;
    if (n) orphans.push(`${fk.child}.${fk.col} → ${fk.parent}: ${n}`);
  }
  if (orphans.length) {
    await dst.query("ROLLBACK");
    throw new Error(`Rows pointing at missing records:\n${orphans.join("\n")}\nNothing was saved.`);
  }
  console.log(`Foreign keys checked: ${fks.length}, all fine.`);
  await dst.query("COMMIT");
  await src.query("ROLLBACK"); // ends the read-only snapshot

  console.table(report);
  console.log(`Copied ${report.reduce((n, r) => n + r.target, 0)} rows in ${report.length} tables. Companies: Platform, GenFusion Tech.`);
  if (ADMIN_EMAIL) {
    const admin = await dst.query(`SELECT count(*)::int AS n FROM "User" WHERE "isPlatformAdmin"`);
    console.log(`Platform Super Admin accounts: ${admin.rows[0].n}`);
  }
  await src.end();
  await dst.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
