import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PLATFORM_COMPANY_ID, currentScope, type TenantScope } from "@/lib/tenant/context";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter } as never);
}

const globalForPrisma = globalThis as unknown as {
  prismaBase?: ReturnType<typeof createPrismaClient>;
};

/**
 * The raw client: sees every company. Only for code that must work across companies or before anyone
 * is signed in: login / activation / password reset, the Super Admin console, scripts. Nothing else.
 */
export const unscopedPrisma = globalForPrisma.prismaBase ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = unscopedPrisma;

/** Same for every company: no companyId */
const GLOBAL_MODELS = new Set<string>(["Company", "Screen", "DailyQuote", "AppMigration"]);
/** Each company also sees the platform's rows (the shared job pool, default keys and settings) */
const SHARED_MODELS = new Set<string>(["JobSearchResult", "JobApiSource", "AtsCompany", "AiProvider", "GmailSettings", "JobIngestConfig"]);

const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const SCOPED_WRITES = new Set(["update", "updateMany", "updateManyAndReturn", "delete", "deleteMany"]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const CREATES = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);

export class TenantError extends Error {}

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: unknown };

/** A relation write in create data (`consultant: { connect: … }`) means the "checked" form: link the company the same way */
const usesRelationLinks = (data: Record<string, unknown>) =>
  Object.values(data).some((v) => !!v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && ("connect" in v || "connectOrCreate" in v));

function withCompany(data: unknown, companyId: string): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const d = data as Record<string, unknown>;
  if ("companyId" in d || "company" in d) return d; // set explicitly (checked below)
  return usesRelationLinks(d) ? { ...d, company: { connect: { id: companyId } } } : { ...d, companyId };
}

/** Code may name a company itself only for its own company, or the platform's shared rows when reading them */
function checkExplicit(model: string, scope: TenantScope, companyId: unknown, reading: boolean) {
  if (scope.all || companyId === undefined) return;
  const ok = (id: unknown) => id === scope.companyId || (reading && SHARED_MODELS.has(model) && id === PLATFORM_COMPANY_ID);
  const ids = companyId && typeof companyId === "object" && "in" in (companyId as object) ? ((companyId as { in: unknown[] }).in ?? []) : [companyId];
  if (!ids.every(ok)) throw new TenantError(`${model}: another company's data was requested`);
}

function scopeArgs(model: string, operation: string, args: Args, scope: TenantScope): Args {
  const reading = READS.has(operation);
  const own = scope.companyId;
  const visible = reading && SHARED_MODELS.has(model) ? { in: [own, PLATFORM_COMPANY_ID] } : own;
  const next: Args = { ...args };

  if (reading || SCOPED_WRITES.has(operation) || operation === "upsert") {
    const where = (args.where ?? {}) as Record<string, unknown>;
    checkExplicit(model, scope, where.companyId, reading);
    // "All companies" (Super Admin): no limit on reads and changes
    if (!scope.all && where.companyId === undefined) {
      // Unique lookups accept extra fields next to the unique key (Prisma's extended where-unique)
      next.where = UNIQUE_OPS.has(operation) ? { ...where, companyId: visible } : { AND: [where, { companyId: visible }] };
    }
  }

  if (operation === "create") next.data = withCompany(args.data, own);
  if (operation === "upsert") next.create = withCompany(args.create, own);
  if (operation === "createMany" || operation === "createManyAndReturn") {
    next.data = Array.isArray(args.data) ? args.data.map((d) => withCompany(d, own)) : withCompany(args.data, own);
  }
  for (const key of ["data", "create"] as const) {
    const d = next[key] as Record<string, unknown> | undefined;
    if (d && typeof d === "object" && !Array.isArray(d)) checkExplicit(model, scope, d.companyId ?? (d.company as { connect?: { id?: unknown } })?.connect?.id, false);
  }
  return next;
}

/**
 * The app's client. Every query on a company table is limited to the current company (the session's,
 * or runAs() in background jobs), and new rows get that company. No company → the query is refused.
 */
export const prisma = unscopedPrisma.$extends({
  name: "tenant",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (GLOBAL_MODELS.has(model)) return query(args);
        const scope = await currentScope();
        if (!scope) throw new TenantError(`${model}.${operation} needs a company (no session and no runAs)`);
        // "All companies" view: new records can't be created (they would land in whichever company the
        // Super Admin last worked in). Changes to existing records stay allowed; the activity log too.
        if (scope.all && CREATES.has(operation) && model !== "ActivityLog") {
          throw new TenantError("The All companies view is read-only for new records. Switch to a company to add one.");
        }
        return query(scopeArgs(model, operation, (args ?? {}) as Args, scope) as typeof args);
      },
    },
  },
});

export type AppPrisma = typeof prisma;
