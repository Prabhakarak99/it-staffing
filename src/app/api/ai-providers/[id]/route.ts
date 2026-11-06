import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/gmail/crypto";
import { PROVIDERS, isProviderId } from "@/lib/ai/catalog";
import { aiAdminSession, listAiProviders, makeDefault } from "@/lib/ai/admin";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH { label?, apiKey? (empty keeps the saved key), model?, baseUrl?, isEnabled?, isDefault? } */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, response } = await aiAdminSession();
  if (response) return response;

  const { id } = await params;
  const row = await prisma.aiProvider.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);
  const needsBaseUrl = isProviderId(row.provider) && PROVIDERS[row.provider].needsBaseUrl;
  const label = str("label");
  const model = str("model");
  const apiKey = str("apiKey");
  const baseUrl = str("baseUrl");
  if (needsBaseUrl && baseUrl !== undefined && !/^https:\/\/\S+$/.test(baseUrl)) {
    return NextResponse.json({ error: "Base URL must start with https://" }, { status: 400 });
  }

  await prisma.aiProvider.update({
    where: { id },
    data: {
      ...(label ? { label: label.slice(0, 100) } : {}),
      ...(model ? { model: model.slice(0, 100) } : {}),
      ...(apiKey ? { apiKeyEnc: encrypt(apiKey), lastError: null } : {}),
      ...(needsBaseUrl && baseUrl ? { baseUrl } : {}),
      ...(typeof body.isEnabled === "boolean" ? { isEnabled: body.isEnabled, ...(body.isEnabled ? {} : { isDefault: false }) } : {}),
      updatedById: session.userId,
    },
  });
  if (body.isDefault === true) await makeDefault(id);
  return NextResponse.json(await listAiProviders());
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { response } = await aiAdminSession();
  if (response) return response;
  const { id } = await params;
  await prisma.aiProvider.deleteMany({ where: { id } });
  return NextResponse.json(await listAiProviders());
}
