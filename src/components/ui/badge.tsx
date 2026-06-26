import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const variants: Record<BadgeVariant, string> = {
  default:  "bg-slate-100 text-slate-600 border border-slate-200",
  success:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning:  "bg-amber-50 text-amber-700 border border-amber-200",
  danger:   "bg-rose-50 text-rose-600 border border-rose-200",
  info:     "bg-indigo-50 text-indigo-600 border border-indigo-200",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
