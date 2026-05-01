import { redirect } from "next/navigation";

export default function AdminPendingPaymentsRedirectPage() {
  redirect("/admin/finance/approvals");
}
