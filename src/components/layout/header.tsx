import { getSession } from "@/lib/auth";

interface HeaderProps {
  title: string;
}

export async function Header({ title }: HeaderProps) {
  const session = await getSession();
  const initials = session?.email?.slice(0, 2).toUpperCase() ?? "A";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-indigo-500" />
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-800">{session?.email ?? "Admin"}</p>
          <p className="text-xs text-slate-400">{session?.roleName ?? "Super Admin"}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
      </div>
    </header>
  );
}
