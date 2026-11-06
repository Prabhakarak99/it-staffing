import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Resumes hold personal details, so they live outside /public and are only served through
 * /api/resumes/[file] to signed-in users. On Fly the /data volume keeps them across deploys.
 */
export function resumeDir() {
  return existsSync("/data") ? "/data/resumes" : path.join(process.cwd(), "storage", "resumes");
}

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const RESUME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const SAFE_NAME = /^[a-z0-9-]+\.(pdf|docx|txt)$/;
export const isStoredName = (name: string) => SAFE_NAME.test(name);

export const extOf = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? "";

/** Stores bytes under a random name and returns it */
export async function saveResume(bytes: Buffer, ext: string, prefix = "resume") {
  if (!RESUME_TYPES[ext]) throw new Error("Upload a PDF or Word (.docx) resume");
  const dir = resumeDir();
  await mkdir(dir, { recursive: true });
  const name = `${prefix}-${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return name;
}

export async function readResume(name: string) {
  if (!isStoredName(name)) throw new Error("Invalid file");
  return readFile(path.join(resumeDir(), name));
}

/** Plain text of a stored resume, for the AI and the ATS check */
export async function resumeText(name: string): Promise<string> {
  const bytes = await readResume(name);
  const ext = extOf(name);
  let text = "";
  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const out = await extractText(pdf, { mergePages: true });
    text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else {
    text = bytes.toString("utf8");
  }
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
