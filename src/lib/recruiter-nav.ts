/** URL state for restoring the recruiters view after navigating away (browser back). */
export type RecruiterViewState = {
  expanded?: string;
  detail?: string;
  filters?: boolean;
  candidate?: string;
};

export function buildRecruiterUrl(state: RecruiterViewState): string {
  const params = new URLSearchParams();
  if (state.detail) params.set("detail", state.detail);
  else if (state.expanded) params.set("expanded", state.expanded);
  if (state.filters) params.set("filters", "1");
  if (state.candidate) params.set("candidate", state.candidate);
  const q = params.toString();
  return `/admin/recruiters${q ? `?${q}` : ""}`;
}

export function parseRecruiterUrl(searchParams: URLSearchParams): RecruiterViewState {
  return {
    expanded: searchParams.get("expanded") ?? undefined,
    detail: searchParams.get("detail") ?? undefined,
    filters: searchParams.get("filters") === "1",
    candidate: searchParams.get("candidate") ?? undefined,
  };
}
