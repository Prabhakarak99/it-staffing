"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

/** Parse deep-link query params shared by submissions/interviews list pages. */
export function useListDeepLink() {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const idsRaw = searchParams.get("ids");
    return {
      initialOpen: searchParams.get("open"),
      initialSearch: searchParams.get("search") ?? "",
      initialIds: idsRaw ? idsRaw.split(",").filter(Boolean) : undefined,
    };
  }, [searchParams]);
}

export function buildScopedListUrl(
  base: "/admin/submissions/list" | "/admin/interviews/list",
  records: { id: string }[]
) {
  if (records.length === 0) return base;
  const params = new URLSearchParams({ ids: records.map((r) => r.id).join(",") });
  if (records.length === 1) params.set("open", records[0].id);
  return `${base}?${params.toString()}`;
}
