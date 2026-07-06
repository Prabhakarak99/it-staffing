import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, compact, ...props }, ref) => (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      {label && (
        <label htmlFor={id} className={cn(
          "font-semibold uppercase tracking-wide text-slate-500",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          compact ? "h-8 px-2.5 text-xs" : "h-10 rounded-xl px-3.5 text-sm",
          error && "border-rose-400 focus:border-rose-400 focus:ring-rose-400/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-[10px] font-medium text-rose-500">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
