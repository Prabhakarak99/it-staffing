import { prisma } from "@/lib/prisma";
import { ConsultantForm } from "./consultant-form";
import { ConsultantList } from "./consultant-list";

export default async function StudentsPage() {
  const consultants = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      personalPhone: true,
      technology: true,
      visaStatus: true,
      projectStatus: true,
      offerLetterType: true,
      workMode: true,
      city: true,
      state: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Consultant Onboarding</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage consultant profiles, documents, visa info, and job placement details.
        </p>
      </div>
      <ConsultantForm />
      <ConsultantList consultants={consultants.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))} />
    </div>
  );
}
