import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

// ── Config ───────────────────────────────────────────────────────────────────

export async function getAutoJobsConfig() {
  return prisma.autoJobsConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

// ── Run creation (called from the submissions POST handler) ─────────────────

export async function createAutoJobRun(submission: {
  id: string;
  clientName: string | null;
  technology: string;
}) {
  const clientName = submission.clientName?.trim();
  if (!clientName) return null;

  return prisma.autoJobRun.create({
    data: {
      triggerSubmissionId: submission.id,
      clientName,
      technology: submission.technology,
    },
  });
}

// ── Matching engine ──────────────────────────────────────────────────────────

const ACTIVE_MARKETING_STATUSES = ["Pre-Marketing", "In-Market"];

async function matchRun(runId: string) {
  const config = await getAutoJobsConfig();
  const run = await prisma.autoJobRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "pending") return;

  const trigger = await prisma.submission.findUnique({
    where: { id: run.triggerSubmissionId },
  });
  if (!trigger) {
    await prisma.autoJobRun.update({
      where: { id: runId },
      data: { status: "failed", note: "Trigger submission no longer exists." },
    });
    return;
  }

  // 1. Vendors serving this client — excluding the vendor already used
  const vendors = await prisma.vendorContact.findMany({
    where: {
      clientName: { equals: run.clientName, mode: "insensitive" },
      doNotContact: false,
      NOT: { email: { equals: trigger.vendorRecruiterEmail, mode: "insensitive" } },
    },
    orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: config.maxVendorsPerRun,
  });

  // 2. Other consultants with the same technology, actively marketing
  const consultants = await prisma.student.findMany({
    where: {
      id: { not: trigger.consultantId },
      technology: { equals: run.technology, mode: "insensitive" },
      projectStatus: { in: ACTIVE_MARKETING_STATUSES },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (vendors.length === 0 || consultants.length === 0) {
    await prisma.autoJobRun.update({
      where: { id: runId },
      data: {
        status: "no_matches",
        vendorsFound: vendors.length,
        matchedConsultants: consultants.length,
        note:
          vendors.length === 0
            ? `No other vendor contacts found for client "${run.clientName}".`
            : `No other active consultants with technology "${run.technology}".`,
      },
    });
    return;
  }

  // 3. Cooldown — skip consultant+vendor pairs already contacted recently
  const cooldownStart = new Date(Date.now() - config.cooldownDays * 24 * 60 * 60 * 1000);
  const recentPairs = await prisma.autoJobApplication.findMany({
    where: {
      consultantId: { in: consultants.map((c) => c.id) },
      vendorEmail: { in: vendors.map((v) => v.email.toLowerCase()) },
      OR: [{ sentAt: { gte: cooldownStart } }, { emailStatus: "queued" }],
    },
    select: { consultantId: true, vendorEmail: true },
  });
  const blocked = new Set(recentPairs.map((p) => `${p.consultantId}|${p.vendorEmail}`));

  // 4. Round-robin: distribute consultants across vendors so no vendor
  //    receives more than one resume for the same trigger
  const applications: {
    runId: string;
    consultantId: string;
    vendorContactId: string;
    vendorEmail: string;
  }[] = [];

  let consultantIndex = 0;
  for (const vendor of vendors) {
    // find the next consultant not blocked for this vendor
    let assigned = false;
    for (let attempt = 0; attempt < consultants.length; attempt++) {
      const consultant = consultants[(consultantIndex + attempt) % consultants.length];
      const key = `${consultant.id}|${vendor.email.toLowerCase()}`;
      if (blocked.has(key)) continue;
      applications.push({
        runId,
        consultantId: consultant.id,
        vendorContactId: vendor.id,
        vendorEmail: vendor.email.toLowerCase(),
      });
      blocked.add(key);
      consultantIndex = (consultantIndex + attempt + 1) % consultants.length;
      assigned = true;
      break;
    }
    if (!assigned) continue; // every consultant is in cooldown for this vendor
  }

  if (applications.length > 0) {
    await prisma.autoJobApplication.createMany({ data: applications, skipDuplicates: true });
  }

  await prisma.autoJobRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      vendorsFound: vendors.length,
      matchedConsultants: consultants.length,
      note:
        applications.length === 0
          ? "All consultant/vendor pairs are within the cooldown window — nothing queued."
          : `${applications.length} application(s) queued.`,
    },
  });
}

// ── Email dispatch (only when autoSend is enabled) ───────────────────────────

const MAX_SENDS_PER_CYCLE = 3;

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function dispatchQueuedApplications() {
  const config = await getAutoJobsConfig();
  if (!config.autoSend || config.paused) return;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.autoJobApplication.count({
    where: { emailStatus: "sent", sentAt: { gte: startOfDay } },
  });
  const remaining = config.dailyCap - sentToday;
  if (remaining <= 0) return;

  const batch = await prisma.autoJobApplication.findMany({
    where: { emailStatus: "queued" },
    orderBy: { createdAt: "asc" },
    take: Math.min(MAX_SENDS_PER_CYCLE, remaining),
    include: {
      consultant: true,
      vendorContact: true,
      run: true,
    },
  });
  if (batch.length === 0) return;

  const transporter = getTransporter();

  for (const app of batch) {
    const consultantName = `${app.consultant.firstName} ${app.consultant.lastName}`.trim();
    const greetName = app.vendorContact.recruiterName?.trim() || "there";
    try {
      await transporter.sendMail({
        from: `"GFT Vision Staffing" <${process.env.SMTP_USER}>`,
        to: app.vendorContact.email,
        subject: `Available Consultant — ${app.run.technology} — ${consultantName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <p>Hi ${greetName},</p>
            <p>We noticed you work with <strong>${app.run.clientName}</strong>. We currently have a strong
            <strong>${app.run.technology}</strong> consultant available who could be a great fit for similar roles:</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Consultant</td><td style="padding:4px 0;font-weight:600;">${consultantName}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Technology</td><td style="padding:4px 0;">${app.consultant.technology ?? app.run.technology}</td></tr>
              ${app.consultant.visaStatus ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Visa Status</td><td style="padding:4px 0;">${app.consultant.visaStatus}</td></tr>` : ""}
              ${app.consultant.city ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Location</td><td style="padding:4px 0;">${app.consultant.city}${app.consultant.state ? `, ${app.consultant.state}` : ""}</td></tr>` : ""}
              ${app.consultant.workMode ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Work Mode</td><td style="padding:4px 0;">${app.consultant.workMode}</td></tr>` : ""}
            </table>
            <p>If you have open requirements with ${app.run.clientName} or other clients, reply to this email and we can share the resume and set up a call.</p>
            <p style="color:#64748b;font-size:13px;margin-top:24px;">GFT Vision Staffing · Reply STOP to opt out of future availability notices.</p>
          </div>
        `,
      });
      await prisma.$transaction([
        prisma.autoJobApplication.update({
          where: { id: app.id },
          data: { emailStatus: "sent", sentAt: new Date(), errorMessage: null },
        }),
        prisma.autoJobRun.update({
          where: { id: app.runId },
          data: { emailsSent: { increment: 1 } },
        }),
      ]);
    } catch (err) {
      await prisma.autoJobApplication.update({
        where: { id: app.id },
        data: {
          emailStatus: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}

// ── Worker entrypoint (called from instrumentation + submission trigger) ────

let processing = false;

export async function processAutoJobs() {
  if (processing) return;
  processing = true;
  try {
    const config = await getAutoJobsConfig();
    if (config.paused) return;

    const pending = await prisma.autoJobRun.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true },
    });
    for (const run of pending) {
      try {
        await matchRun(run.id);
      } catch (err) {
        await prisma.autoJobRun.update({
          where: { id: run.id },
          data: { status: "failed", note: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    await dispatchQueuedApplications();
  } catch (err) {
    console.error("[autojobs] worker cycle failed:", err);
  } finally {
    processing = false;
  }
}
