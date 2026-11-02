export const dynamic = "force-dynamic";

import { getJobFeedOverview } from "@/lib/jobfeed/overview";
import { SourcesView } from "./sources-view";

export default async function JobSourcesPage() {
  return <SourcesView initial={await getJobFeedOverview()} />;
}
