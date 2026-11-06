import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/user-safe";
import { decrypt } from "@/lib/gmail/crypto";
import { PROVIDERS, isProviderId } from "./catalog";

export const AI_SETTINGS_SCREEN = { name: "AI Settings", path: "/admin/ai-settings" };

/** AI keys are an admin job: Super Admin or anyone who can manage users */
export async function aiAdminSession() {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageUsers(session)) return { response: NextResponse.json({ error: "Only administrators can manage AI settings" }, { status: 403 }) };
  return { session };
}

const mask = (key: string) => (key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`);

export interface AiProviderRow {
  id: string;
  provider: string;
  providerName: string;
  label: string;
  model: string;
  baseUrl: string | null;
  keyPreview: string;
  isEnabled: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
}

/** Providers for the settings page; keys only as a masked preview */
export async function listAiProviders(): Promise<AiProviderRow[]> {
  const rows = await prisma.aiProvider.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return rows.map((r) => {
    let keyPreview = "••••";
    try {
      keyPreview = mask(decrypt(r.apiKeyEnc));
    } catch {}
    return {
      id: r.id,
      provider: r.provider,
      providerName: isProviderId(r.provider) ? PROVIDERS[r.provider].name : r.provider,
      label: r.label,
      model: r.model,
      baseUrl: r.baseUrl,
      keyPreview,
      isEnabled: r.isEnabled,
      isDefault: r.isDefault,
      lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
      lastError: r.lastError,
    };
  });
}

/** Only one default; the first provider added becomes it automatically */
export async function makeDefault(id: string) {
  await prisma.$transaction([
    prisma.aiProvider.updateMany({ where: { id: { not: id } }, data: { isDefault: false } }),
    prisma.aiProvider.update({ where: { id }, data: { isDefault: true, isEnabled: true } }),
  ]);
}
