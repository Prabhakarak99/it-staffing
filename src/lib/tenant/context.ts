import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which company the current code is working for.
 * - In a page or API request: the signed-in user's company, from the session cookie.
 * - In a background job or script: whatever runAs() set.
 * `all` = the Platform Super Admin's "All companies" view: reads are not limited to one company.
 */
export interface TenantScope {
  companyId: string;
  all?: boolean;
}

/** The hidden company that owns shared data (the shared job pool, default API keys) */
export const PLATFORM_COMPANY_ID = "platform";

const store = new AsyncLocalStorage<TenantScope>();

/** Runs `fn` for one company (background jobs, scripts, login before a session exists) */
export function runAs<T>(scope: TenantScope | string, fn: () => Promise<T>): Promise<T> {
  return store.run(typeof scope === "string" ? { companyId: scope } : scope, fn);
}

/** The scope set by runAs(), if any (no session lookup) */
export const explicitScope = () => store.getStore() ?? null;

/** The current company: runAs() first, else the session of the request being served */
export async function currentScope(): Promise<TenantScope | null> {
  const set = store.getStore();
  if (set) return set;
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session?.companyId) return { companyId: session.companyId, all: !!session.allCompanies };
  } catch {
    // Outside a request (no cookies): no company
  }
  return null;
}

/** The current company's id; throws when there is none (use inside a request or runAs) */
export async function currentCompanyId(): Promise<string> {
  const scope = await currentScope();
  if (!scope) throw new Error("No company: call inside a signed-in request or runAs()");
  return scope.companyId;
}
