import { prisma } from "@/lib/prisma";
import { isCategory, type EmailTemplateDto } from "./render";

export const MAX_TEMPLATES = 50;
export const MAX_SIGNATURE = 2000;

/** The user's own templates and signature */
export async function myEmailSetup(userId: string): Promise<{ signature: string; templates: EmailTemplateDto[] }> {
  const [user, templates] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { emailSignature: true } }),
    prisma.emailTemplate.findMany({ where: { userId }, orderBy: [{ category: "asc" }, { isDefault: "desc" }, { name: "asc" }] }),
  ]);
  return {
    signature: user?.emailSignature ?? "",
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: isCategory(t.category) ? t.category : "general",
      subject: t.subject,
      body: t.body,
      isDefault: t.isDefault,
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

/** Validates a create / update payload; returns the cleaned fields or an error message */
export function parseTemplate(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 300) : "";
  const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n").slice(0, 20_000) : "";
  const category = isCategory(body.category) ? body.category : "general";
  if (!name) return { error: "Give the template a name" } as const;
  if (!text.trim()) return { error: "Write the email message" } as const;
  return { data: { name, subject, body: text, category, isDefault: body.isDefault === true } } as const;
}
