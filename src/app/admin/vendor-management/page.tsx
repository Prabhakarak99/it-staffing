import { redirect } from "next/navigation";
import { getVendorAccess } from "@/lib/vendors/access";
import { listVendors } from "@/lib/vendors/list";
import { VendorManagementView } from "./vendor-management-view";

export const dynamic = "force-dynamic";

export default async function VendorManagementPage() {
  const access = await getVendorAccess();
  if (!access.ok) redirect(access.status === 401 ? "/login" : "/admin");
  return <VendorManagementView initial={await listVendors(access)} />;
}
