"use client";

import { useEffect } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl text-sm font-medium border backdrop-blur-sm min-w-[280px]",
        type === "success"
          ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-200"
          : "bg-rose-600 text-white border-rose-500 shadow-rose-200"
      )}
    >
      {type === "success"
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <XCircle className="h-4 w-4 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity ml-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const show = (message: string, type: ToastType = "success") => setToast({ message, type });
  const hide = () => setToast(null);
  return { toast, show, hide };
}
