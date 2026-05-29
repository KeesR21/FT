import { redirect } from "next/navigation";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export default async function PortalLandingPage() {
  const account = await getCurrentPortalAccount();
  if (account) redirect("/portal/dashboard");
  redirect("/portal/login");
}
