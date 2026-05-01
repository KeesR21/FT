"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { adminApiFetch } from "@/lib/admin-api-fetch";

export default function AdminLogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    await adminApiFetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" className={clsx("admin-logout-btn", className)} onClick={logout}>
      Log out
    </button>
  );
}
