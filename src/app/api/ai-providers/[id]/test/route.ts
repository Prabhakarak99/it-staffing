import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/gmail/crypto";
import { isProviderId } from "@/lib/ai/catalog";
import { aiAdminSession, listAiProviders } from "@/lib/ai/admin";
import { testAi } from "@/lib/ai/providers";

type RouteContext = { params: Promise<{ id: string }> };

/** POST — sends a tiny request with the saved key and model, and records the result */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { response } = await aiAdminSession();
  if (response) return response;

  const { id } = await params;
  const row = await prisma.aiProvider.findUnique({ where: { id } });
  if (!row || !isProviderId(row.provider)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let error: string | null = null;
  try {
    await testAi({ id: row.id, provider: row.provider, label: row.label, model: row.model, apiKey: decrypt(row.apiKeyEnc), baseUrl: row.baseUrl });
  } catch (err) {
    error = err instanceof Error ? err.message : "Test failed";
  }
  await prisma.aiProvider.update({ where: { id }, data: { lastTestedAt: new Date(), lastError: error?.slice(0, 300) ?? null } });
  return NextResponse.json({ ok: !error, error, providers: await listAiProviders() });
}
