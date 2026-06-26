import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          error && "border-rose-400 focus:border-rose-400 focus:ring-rose-400/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
