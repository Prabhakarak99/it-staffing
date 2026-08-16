import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const maxDuration = 120;

// Simple CSV parser that handles quoted fields and embedded commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Map flexible header names to our fields
function buildColumnMap(headers: string[]) {
  const map: Record<string, number> = {};
  headers.forEach((raw, index) => {
    const h = raw.trim().toLowerCase();
    if (map.email === undefined && h.includes("email")) map.email = index;
    else if (map.vendorCompany === undefined && h.includes("vendor") && !h.includes("name") && !h.includes("email") && !h.includes("phone")) map.vendorCompany = index;
    else if (map.vendorCompany === undefined && (h === "company" || h.includes("vendor company"))) map.vendorCompany = index;
    else if (map.recruiterName === undefined && (h.includes("recruiter") || h === "name" || h.includes("contact name"))) map.recruiterName = index;
    else if (map.phone === undefined && (h.includes("phone") || h.includes("mobile") || h.includes("contact number"))) map.phone = index;
    else if (map.implementationName === undefined && (h.includes("implementation") || h.includes("partner"))) map.implementationName = index;
    else if (map.clientName === undefined && h.includes("client")) map.clientName = index;
    else if (map.technology === undefined && (h.includes("technology") || h.includes("skill") || h === "tech")) map.technology = index;
    else if (map.lastActivityAt === undefined && h.includes("date")) map.lastActivityAt = index;
  });
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded. Attach a CSV file as 'file'." }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV appears to be empty (needs a header row and data rows)." }, { status: 400 });
    }

    const columns = buildColumnMap(rows[0]);
    if (columns.email === undefined || columns.vendorCompany === undefined || columns.clientName === undefined) {
      return NextResponse.json(
        {
          error:
            "Could not detect required columns. The CSV header must include columns for: vendor (company), client, and email. Detected headers: " +
            rows[0].join(", "),
        },
        { status: 400 }
      );
    }

    const get = (row: string[], key: string) => {
      const idx = columns[key];
      return idx === undefined ? "" : (row[idx] ?? "").trim();
    };

    const records: {
      vendorCompany: string;
      recruiterName: string | null;
      email: string;
      phone: string | null;
      implementationName: string | null;
      clientName: string;
      technology: string | null;
      lastActivityAt: Date | null;
      source: string;
    }[] = [];
    let skippedInvalid = 0;
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = get(row, "email").toLowerCase();
      const vendorCompany = get(row, "vendorCompany");
      const clientName = get(row, "clientName");

      if (!EMAIL_RE.test(email) || !vendorCompany || !clientName) {
        skippedInvalid++;
        continue;
      }
      const dedupeKey = `${email}|${clientName.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        skippedInvalid++;
        continue;
      }
      seen.add(dedupeKey);

      const dateRaw = get(row, "lastActivityAt");
      const parsedDate = dateRaw ? new Date(dateRaw) : null;

      records.push({
        vendorCompany,
        recruiterName: get(row, "recruiterName") || null,
        email,
        phone: get(row, "phone") || null,
        implementationName: get(row, "implementationName") || null,
        clientName,
        technology: get(row, "technology") || null,
        lastActivityAt: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
        source: `import-${new Date().toISOString().slice(0, 10)}`,
      });
    }

    // Insert in chunks; skipDuplicates honors the (email, clientName) unique key
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
      const result = await prisma.vendorContact.createMany({
        data: records.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    return NextResponse.json({
      totalRows: rows.length - 1,
      inserted,
      duplicatesSkipped: records.length - inserted,
      invalidSkipped: skippedInvalid,
    });
  } catch (err) {
    console.error("[autojobs] import failed:", err);
    return NextResponse.json({ error: "Import failed. Check the file format." }, { status: 500 });
  }
}
