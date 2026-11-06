import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/gmail/crypto";
import { PROVIDERS, isProviderId } from "@/lib/ai/catalog";
import { aiAdminSession, listAiProviders, makeDefault } from "@/lib/ai/admin";

export async function GET() {
  const { response } = await aiAdminSession();
  if (response) return response;
  return NextResponse.json(await listAiProviders());
}

/** POST { provider, label?, apiKey, model, baseUrl?, isDefault? } */
export async function POST(req: NextRequest) {
  const { session, response } = await aiAdminSession();
  if (response) return response;

  const body = (await req.json()) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  if (!isProviderId(body.provider)) return NextResponse.json({ error: "Choose a provider" }, { status: 400 });
  const meta = PROVIDERS[body.provider];
  if (!str("apiKey")) return NextResponse.json({ error: "API key is required" }, { status: 400 });
  if (!str("model")) return NextResponse.json({ error: "Model is required" }, { status: 400 });
  if (meta.needsBaseUrl && !/^https:\/\/\S+$/.test(str("baseUrl"))) {
    return NextResponse.json({ error: "Base URL must start with https://" }, { status: 400 });
  }

  const first = (await prisma.aiProvider.count()) === 0;
  const row = await prisma.aiProvider.create({
    data: {
      provider: body.provider,
      label: (str("label") || meta.name).slice(0, 100),
      apiKeyEnc: encrypt(str("apiKey")),
      model: str("model").slice(0, 100),
      baseUrl: meta.needsBaseUrl ? str("baseUrl") : null,
      updatedById: session.userId,
    },
  });
  if (first || body.isDefault === true) await makeDefault(row.id);
  return NextResponse.json(await listAiProviders(), { status: 201 });
}
