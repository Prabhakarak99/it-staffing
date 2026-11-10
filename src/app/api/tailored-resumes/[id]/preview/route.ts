import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readResume } from "@/lib/files/resumes";
import { countTerm } from "@/lib/easy/ats";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — the AI-updated resume as HTML for the preview popup, with the JD keywords and their counts */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const t = await prisma.tailoredResume.findUnique({
    where: { id },
    select: { file: true, fileName: true, atsBefore: true, atsAfter: true, keywords: true },
  });
  if (!t) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readResume(t.file);
  } catch {
    return NextResponse.json({ error: "The resume file is missing" }, { status: 404 });
  }
  const mammoth = await import("mammoth");
  const [{ value: html }, { value: text }] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);

  type Planned = { term: string; priority?: string; evidence?: string; note?: string };
  const kw = (t.keywords ?? {}) as { matched?: string[]; missing?: string[]; plan?: Planned[] };
  // Older resumes have no plan: just their keyword list
  const planned: Planned[] = kw.plan?.length ? kw.plan : [...new Set([...(kw.matched ?? []), ...(kw.missing ?? [])])].map((term) => ({ term }));
  const rank: Record<string, number> = { main: 0, required: 1, preferred: 2 };
  const keywords = planned
    .map((k) => ({ term: k.term, count: countTerm(text, k.term), priority: k.priority ?? null, evidence: k.evidence ?? null, note: k.note ?? null }))
    .sort((a, b) => (rank[a.priority ?? ""] ?? 1) - (rank[b.priority ?? ""] ?? 1) || b.count - a.count || a.term.localeCompare(b.term));

  return NextResponse.json(
    {
      html,
      file: t.file,
      fileName: t.fileName,
      atsBefore: t.atsBefore,
      atsAfter: t.atsAfter,
      keywords,
      total: keywords.length,
      found: keywords.filter((k) => k.count > 0).length,
      mentions: keywords.reduce((n, k) => n + k.count, 0),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
