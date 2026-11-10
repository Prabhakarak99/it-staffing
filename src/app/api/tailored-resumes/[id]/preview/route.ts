import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readResume } from "@/lib/files/resumes";

type RouteContext = { params: Promise<{ id: string }> };

/** How many times each JD keyword appears in the resume (whole-term, same rule as the ATS score) */
function keywordCounts(text: string, terms: string[]) {
  const hay = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  return terms.map((term) => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const count = hay.match(new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "g"))?.length ?? 0;
    return { term, count };
  });
}

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

  const kw = (t.keywords ?? {}) as { matched?: string[]; missing?: string[] };
  const terms = [...new Set([...(kw.matched ?? []), ...(kw.missing ?? [])])];
  const keywords = keywordCounts(text, terms).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

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
