import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendActivationEmail(
  to: string,
  name: string,
  token: string,
  accountType: "user" | "recruiter" = "user"
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/activate?token=${token}&type=${accountType}`;
  const label = accountType === "recruiter" ? "Recruiter" : "User";

  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"IT Staffing Solutions" <${process.env.SMTP_USER}>`,
    to,
    subject: `Activate Your ${label} Account – IT Staffing Solutions`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#1e40af;padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:20px;">IT Staffing Solutions</h1>
          <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${label} Account Activation</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1e293b;margin:0 0 8px;">Welcome, ${name}!</h2>
          <p style="color:#475569;margin:0 0 24px;">Your ${label.toLowerCase()} account has been created. Click the button below to set your password and activate your account.</p>
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:#1e40af;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Activate Account
          </a>
          <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">This link expires in <strong>24 hours</strong>. If you did not expect this email, please ignore it.</p>
        </div>
      </div>
    `,
  });
}
