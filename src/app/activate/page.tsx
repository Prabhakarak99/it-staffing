export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivateForm } from "./activate-form";
import { Briefcase, LinkIcon, Clock } from "lucide-react";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { activationToken: token },
    select: { firstName: true, lastName: true, email: true, isActive: true, activationExpiry: true },
  });

  if (!user) {
    return <ErrorCard title="Invalid Link" message="This activation link is invalid or has already been used." icon="link" />;
  }

  if (Boolean(user.isActive)) redirect("/login");

  if (user.activationExpiry && new Date() > user.activationExpiry) {
    return <ErrorCard title="Link Expired" message="This activation link has expired. Please ask your administrator to resend it." icon="clock" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 mb-4">
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">GFT Vision</h1>
          <p className="text-sm text-slate-500 mt-1">Set your password to activate your account</p>
        </div>

        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-center">
          <p className="text-sm font-medium text-blue-800">
            Welcome, {user.firstName} {user.lastName}!
          </p>
          <p className="text-xs text-blue-600 mt-0.5">{user.email}</p>
        </div>

        <ActivateForm token={token} email={user.email} />
      </div>
    </div>
  );
}

function ErrorCard({ title, message, icon }: { title: string; message: string; icon: "link" | "clock" }) {
  const Icon = icon === "clock" ? Clock : LinkIcon;
  const isExpired = icon === "clock";
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-sm w-full shadow-sm">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isExpired ? "bg-yellow-100" : "bg-red-100"}`}>
          <Icon className={`h-6 w-6 ${isExpired ? "text-yellow-600" : "text-red-600"}`} />
        </div>
        <p className="text-lg font-semibold text-slate-900 mb-2">{title}</p>
        <p className="text-sm text-slate-500">{message}</p>
        <a href="/login" className="mt-5 inline-block text-sm text-blue-600 hover:underline">Back to login</a>
      </div>
    </div>
  );
}
