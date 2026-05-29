"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, Suspense } from "react";
import {
  AccountPrimaryButton,
  PasswordChangeFields
} from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { adminApiFetch, parseAdminApiBody } from "@/lib/admin-api-fetch";
import { validatePasswordStrength } from "@/lib/password-strength";

const LOGIN_BG = "/gallery/FTPR_18.JPG";

function AdminResetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const notify = usePortalAuthNotify();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    const s = validatePasswordStrength(newPassword);
    return Boolean(token) && s.ok && newPassword === confirmPassword;
  }, [confirmPassword, newPassword, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await adminApiFetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
      const parsed = await parseAdminApiBody<{ message?: string }>(res, { redirectOn401: false });
      if (!parsed.ok) {
        notify.error(parsed.message, { duration: 7500, status: res.status });
        return;
      }
      notify.success("Password saved. Sign in with your new credentials.", { duration: 5000 });
      window.setTimeout(() => {
        router.push("/admin/login");
        router.refresh();
      }, 700);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" aria-hidden>
        <Image src={LOGIN_BG} alt="" fill className="admin-login-bg-image" sizes="100vw" priority quality={80} />
        <div className="admin-login-bg-veil" />
        <div className="admin-login-bg-accent" />
      </div>

      <div className="admin-login-page-inner">
        <div className="admin-login-shell admin-login-shell--narrow">
          <div className="admin-login-form-col">
            <div className="admin-login-form-head">
              <h1 className="admin-login-form-title">Set a new password</h1>
              <p className="admin-login-form-lead">
                Pick a strong password — your previous administrator sessions stay signed out.
              </p>
            </div>
            {!token ? (
              <p className="form-message" role="alert">
                This reset link is missing or malformed. Request a fresh link from{" "}
                <Link href="/admin/forgot-password">forgot password</Link>.
              </p>
            ) : (
              <form className="admin-login-form" onSubmit={(e) => void submit(e)} noValidate>
                <PasswordChangeFields
                  showCurrent={false}
                  busy={busy}
                  currentPassword=""
                  newPassword={newPassword}
                  confirmPassword={confirmPassword}
                  onCurrentChange={() => {}}
                  onNewChange={setNewPassword}
                  onConfirmChange={setConfirmPassword}
                  newId="admin-reset-new"
                  confirmId="admin-reset-confirm"
                />
                <div className="admin-login-actions-row">
                  <AccountPrimaryButton busy={busy} disabled={!canSubmit}>
                    Save new password
                  </AccountPrimaryButton>
                </div>
                <p className="admin-login-foot-link">
                  <Link href="/admin/login" className="ks-text-link">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <AdminResetPasswordInner />
    </Suspense>
  );
}
