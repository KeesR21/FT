import { KitsManagementClient } from "./kits-management-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminKitsPage() {
  return <KitsManagementClient />;
}
