import { KitOrdersAdminClient } from "./kit-orders-admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminKitOrdersPage() {
  return <KitOrdersAdminClient />;
}
