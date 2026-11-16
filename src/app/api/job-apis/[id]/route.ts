import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/gmail/crypto";
import { aiAdminSession } from "@/lib/ai/admin";
import { DEFAULT_KEYWORDS, JOB_APIS, isJobApiId } from "@/lib/jobfeed/apis/catalog";
import { listJobApis, runJobApi, testJobApi } from "@/lib/jobfeed/apis";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

const lines = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\n,]+/) : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

/** PATCH { apiKey? (empty keeps the saved key), removeKey?, isEnabled?, intervalMin?, maxPerRun?, keywords?, contractOnly?, extraParams?, startUrls? } */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, response } = await aiAdminSession();
  if (response) return response;
  const { id } = await params;
  if (!isJobApiId(id)) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const num = (k: string, min: number, max: number) => (typeof body[k] === "number" && Number.isFinite(body[k]) ? Math.min(max, Math.max(min, Math.round(body[k] as number))) : undefined);
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const startUrls = body.startUrls !== undefined ? lines(body.startUrls, 25) : undefined;
  if (startUrls?.some((u) => !/^https:\/\/\S+$/i.test(u))) return NextResponse.json({ error: "Every page to read must start with https://" }, { status: 400 });

  const existing = await prisma.jobApiSource.findUnique({ where: { id }, select: { apiKeyEnc: true } });
  const willHaveKey = body.removeKey === true ? false : !!apiKey || !!existing?.apiKeyEnc;
  if (body.isEnabled === true && !willHaveKey) return NextResponse.json({ error: "Add the API key before turning this on" }, { status: 400 });

  const data = {
    ...(apiKey ? { apiKeyEnc: encrypt(apiKey), lastError: null, lastTestError: null, lastTestedAt: null } : {}),
    ...(body.removeKey === true ? { apiKeyEnc: null, isEnabled: false } : {}),
    ...(typeof body.isEnabled === "boolean" && body.removeKey !== true ? { isEnabled: body.isEnabled } : {}),
    ...(num("intervalMin", 15, 1440) !== undefined ? { intervalMin: num("intervalMin", 15, 1440) } : {}),
    ...(num("maxPerRun", 1, 1000) !== undefined ? { maxPerRun: num("maxPerRun", 1, 1000) } : {}),
    ...(body.keywords !== undefined ? { keywords: lines(body.keywords, 30).join("\n") } : {}),
    ...(typeof body.contractOnly === "boolean" ? { contractOnly: body.contractOnly } : {}),
    ...(typeof body.extraParams === "string" ? { extraParams: body.extraParams.trim().slice(0, 1000) } : {}),
    ...(startUrls ? { startUrls: startUrls.join("\n") } : {}),
    updatedById: session.userId,
  };
  await prisma.jobApiSource.upsert({
    where: { id },
    create: { id, intervalMin: JOB_APIS[id].defaultIntervalMin, keywords: DEFAULT_KEYWORDS.join("\n"), ...data },
    update: data,
  });
  return NextResponse.json(await listJobApis());
}

/** POST ?action=test (3 jobs, nothing saved) | ?action=run (one pull into Requirements now) */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { response } = await aiAdminSession();
  if (response) return response;
  const { id } = await params;
  if (!isJobApiId(id)) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const result = req.nextUrl.searchParams.get("action") === "run" ? await runJobApi(id) : await testJobApi(id);
  return NextResponse.json({ ...result, apis: await listJobApis() });
}
