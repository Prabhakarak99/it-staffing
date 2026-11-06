import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";

export interface TailoredResumeContent {
  name: string;
  title: string;
  summary: string[];
  skills: { category: string; items: string[] }[];
  experience: {
    client: string;
    role: string;
    location?: string | null;
    duration: string;
    description?: string | null;
    responsibilities: string[];
    environment?: string | null;
  }[];
  education: string[];
  certifications: string[];
}

const FONT = "Calibri";

const heading = (text: string) =>
  new Paragraph({
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F3864", space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: "1F3864", font: FONT })],
  });

const bullet = (text: string) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 21, font: FONT })] });

const line = (parts: { text: string; bold?: boolean; italics?: boolean }[], after = 40) =>
  new Paragraph({ spacing: { after }, children: parts.map((p) => new TextRun({ ...p, size: 21, font: FONT })) });

/** Plain, ATS-friendly Word resume: single column, real text, standard section names */
export async function buildResumeDocx(r: TailoredResumeContent): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.name, bold: true, size: 32, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: r.title, size: 24, color: "444444", font: FONT })] }),
  ];

  if (r.summary.length) {
    children.push(heading("Professional Summary"), ...r.summary.map(bullet));
  }
  if (r.skills.length) {
    children.push(heading("Technical Skills"));
    for (const s of r.skills) children.push(line([{ text: `${s.category}: `, bold: true }, { text: s.items.join(", ") }]));
  }
  if (r.experience.length) {
    children.push(heading("Professional Experience"));
    for (const e of r.experience) {
      children.push(
        line([{ text: `Client: ${e.client}`, bold: true }, ...(e.location ? [{ text: `, ${e.location}` }] : []), { text: `\t${e.duration}` }], 20),
        line([{ text: `Role: ${e.role}`, bold: true, italics: true }], 60),
      );
      if (e.description) children.push(line([{ text: e.description }], 60));
      children.push(line([{ text: "Responsibilities:", bold: true }], 20), ...e.responsibilities.map(bullet));
      if (e.environment) children.push(line([{ text: "Environment: ", bold: true }, { text: e.environment }], 160));
    }
  }
  if (r.education.length) children.push(heading("Education"), ...r.education.map(bullet));
  if (r.certifications.length) children.push(heading("Certifications"), ...r.certifications.map(bullet));

  const doc = new Document({
    creator: "GFT Vision",
    title: `${r.name} - Resume`,
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}

/** Same content as text, for the ATS check */
export function resumeContentText(r: TailoredResumeContent) {
  return [
    r.name,
    r.title,
    ...r.summary,
    ...r.skills.map((s) => `${s.category}: ${s.items.join(", ")}`),
    ...r.experience.flatMap((e) => [e.client, e.role, e.location ?? "", e.duration, e.description ?? "", ...e.responsibilities, e.environment ?? ""]),
    ...r.education,
    ...r.certifications,
  ].join("\n");
}
