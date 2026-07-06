"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Highlight every case-insensitive match of `query` in `text` with yellow background. */
export function HighlightText({
  text,
  query,
  className,
  empty = "—",
}: {
  text: string | number | null | undefined;
  query: string;
  className?: string;
  empty?: string;
}) {
  const value = text == null ? "" : String(text).trim();
  const q = query.trim();

  if (!value) {
    return <span className={className}>{empty}</span>;
  }

  if (!q) {
    return <span className={className}>{value}</span>;
  }

  const lowerValue = value.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lowerValue.indexOf(lowerQ, start);
  let key = 0;

  while (index !== -1) {
    if (index > start) {
      parts.push(<span key={key++}>{value.slice(start, index)}</span>);
    }
    parts.push(
      <mark
        key={key++}
        className="rounded-sm bg-yellow-200 px-0.5 text-inherit"
      >
        {value.slice(index, index + q.length)}
      </mark>
    );
    start = index + q.length;
    index = lowerValue.indexOf(lowerQ, start);
  }

  if (start < value.length) {
    parts.push(<span key={key++}>{value.slice(start)}</span>);
  }

  return <span className={cn(className)}>{parts}</span>;
}
