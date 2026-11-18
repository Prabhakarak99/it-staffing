import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { COMPANY_HINT_COOKIE, loginPath } from "@/lib/tenant/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/admin");
  // Signed out: the company login page this browser last used
  redirect(loginPath((await cookies()).get(COMPANY_HINT_COOKIE)?.value));
}
