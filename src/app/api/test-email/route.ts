import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    passSet: !!process.env.SMTP_PASS,
    passLength: process.env.SMTP_PASS?.length ?? 0,
  };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Step 1: Verify SMTP connection
  try {
    await transporter.verify();
  } catch (err: unknown) {
    return NextResponse.json({
      step: "SMTP connection verify",
      config,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  // Step 2: Send test email
  try {
    const info = await transporter.sendMail({
      from: `"IT Staffing Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: "IT Staffing – Email Test",
      text: "Email is working correctly!",
    });
    return NextResponse.json({ success: true, messageId: info.messageId, config });
  } catch (err: unknown) {
    return NextResponse.json({
      step: "sendMail",
      config,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
