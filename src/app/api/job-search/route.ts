import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const technology  = searchParams.get("technology")  ?? undefined;
  const source      = searchParams.get("source")      ?? undefined;
  const jobType     = searchParams.get("jobType")     ?? undefined;
  const isRemote    = searchParams.get("isRemote");
  const location    = searchParams.get("location")    ?? undefined;
  const keyword     = searchParams.get("keyword")     ?? undefined;
  const dateFrom    = searchParams.get("dateFrom")    ?? undefined;
  const rateMin     = searchParams.get("rateMin")     ?? undefined;
  const rateMax     = searchParams.get("rateMax")     ?? undefined;
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit       = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isActive: true };

  if (technology) where.technology = { equals: technology, mode: "insensitive" };
  if (source)     where.source     = source;
  if (jobType)    where.jobType    = { contains: jobType, mode: "insensitive" };
  if (isRemote === "true")  where.isRemote = true;
  if (isRemote === "false") where.isRemote = false;

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  if (keyword) {
    where.OR = [
      { title:          { contains: keyword, mode: "insensitive" } },
      { jobDescription: { contains: keyword, mode: "insensitive" } },
      { vendorName:     { contains: keyword, mode: "insensitive" } },
      { clientName:     { contains: keyword, mode: "insensitive" } },
    ];
  }

  if (dateFrom) {
    where.dateScraped = { gte: new Date(dateFrom) };
  }

  if (rateMin) where.rateMin = { gte: parseInt(rateMin) };
  if (rateMax) where.rateMax = { lte: parseInt(rateMax) };

  const [jobs, total] = await Promise.all([
    prisma.jobSearchResult.findMany({
      where,
      orderBy: { dateScraped: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, jobId: true, title: true, technology: true, technologies: true,
        source: true, vendorName: true, vendorEmail: true, vendorPhone: true,
        location: true, isRemote: true, jobType: true, rateMin: true, rateMax: true,
        clientName: true, datePosted: true, dateScraped: true, applyLink: true,
        visaRequirements: true, jobDescription: true,
      },
    }),
    prisma.jobSearchResult.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, limit, pages: Math.ceil(total / limit) });
}
