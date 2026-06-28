// Page-level sub-header: title + optional breadcrumb.
// User info now lives in TopNav — this component just labels the current page.

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white px-6 py-3.5 shadow-sm shadow-slate-100/80">
      <div className="h-5 w-0.5 rounded-full bg-indigo-500" />
      <div>
        <h1 className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
