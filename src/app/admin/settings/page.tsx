"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AccountPrimaryButton,
  PasswordChangeFields
} from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { adminApiFetch, parseAdminApiBody } from "@/lib/admin-api-fetch";
import { validatePasswordStrength } from "@/lib/password-strength";

export default function AdminSettingsPage() {
  const router = useRouter();
  const notify = usePortalAuthNotify();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    const s = validatePasswordStrength(newPassword);
    return (
      currentPassword.length > 0 &&
      s.ok &&
      newPassword === confirmPassword &&
      newPassword.length > 0
    );
  }, [currentPassword, confirmPassword, newPassword]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await adminApiFetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const parsed = await parseAdminApiBody<{ message?: string }>(res);
      if (!parsed.ok) {
        notify.error(parsed.message || "Could not update password.", { duration: 7000, status: res.status });
        return;
      }
      notify.success("Password updated successfully.", { duration: 4500 });
      window.setTimeout(() => {
        router.push("/admin/login?fresh=1");
        router.refresh();
      }, 600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-settings-page page-stack">
      <header className="admin-settings-head">
        <h1 className="admin-settings-title">Profile &amp; security</h1>
        <p className="muted">
          Signed-in administrators manage the academy dashboard here. Updating your password will sign every active
          session out — you&apos;ll log in again with the new credentials.
        </p>
      </header>

      <section className="card admin-settings-card">
        <h2 className="admin-settings-card__title">Change password</h2>
        <form className="admin-settings-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <PasswordChangeFields
            showCurrent
            busy={busy}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onCurrentChange={setCurrentPassword}
            onNewChange={setNewPassword}
            onConfirmChange={setConfirmPassword}
            currentId="admin-pw-current"
            newId="admin-pw-new"
            confirmId="admin-pw-confirm"
          />
          <div className="admin-settings-actions">
            <AccountPrimaryButton busy={busy} disabled={!canSubmit}>
              Update password &amp; sign out
            </AccountPrimaryButton>
            <Link href="/admin/forgot-password" className="admin-settings-secondary-link">
              Forgot password?
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
