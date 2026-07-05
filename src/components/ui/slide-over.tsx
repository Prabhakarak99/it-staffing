"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function SlideOver({ open, onClose, children, maxWidth = "max-w-6xl" }: SlideOverProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding panel — pushed to the right */}
      <div
        className={cn(
          "relative ml-auto flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl shadow-black/30",
          maxWidth
        )}
        style={{ animation: "slideFromRight 240ms cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Floating close button on top of whatever header the form renders */}
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
