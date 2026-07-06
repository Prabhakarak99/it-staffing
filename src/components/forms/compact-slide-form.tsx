import { cn } from "@/lib/utils";

export function SlideFormShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {children}
    </div>
  );
}

export function SlideFormHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
  tone = "violet",
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "violet" | "emerald" | "sky" | "amber" | "indigo" | "rose";
}) {
  const tones: Record<string, string> = {
    violet: "from-violet-600 to-purple-700",
    emerald: "from-emerald-600 to-teal-700",
    sky: "from-sky-600 to-blue-700",
    amber: "from-amber-500 to-orange-600",
    indigo: "from-indigo-600 to-violet-700",
    rose: "from-rose-600 to-pink-700",
  };

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-r px-4 py-3", tones[tone])}>
      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold leading-tight text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-white/70">{subtitle}</p>}
        </div>
        {badge}
        {actions}
      </div>
    </div>
  );
}

export function SlideFormBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-3 p-4", className)}>{children}</div>;
}

export function SlideFormSections({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{children}</div>;
}

export function SlideFormSection({
  icon: Icon,
  title,
  color = "slate",
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  color?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
    violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-500" },
    blue: { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-500" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-500" },
    amber: { bg: "bg-amber-50", border: "border-amber-100", icon: "text-amber-500" },
    rose: { bg: "bg-rose-50", border: "border-rose-100", icon: "text-rose-500" },
    indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "text-indigo-500" },
    slate: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500" },
  };
  const c = colorMap[color] ?? colorMap.slate;

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      <div className={cn("flex items-center gap-2 rounded-t-lg border-b px-3 py-2", c.bg, c.border)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", c.icon)} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{title}</span>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

export function SlideFormGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const gridCols = cols === 4
    ? "sm:grid-cols-2 lg:grid-cols-4"
    : cols === 2
      ? "sm:grid-cols-2"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return <div className={cn("grid grid-cols-1 gap-2", gridCols)}>{children}</div>;
}

export function SlideFormFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-sm">
      {children}
    </div>
  );
}
