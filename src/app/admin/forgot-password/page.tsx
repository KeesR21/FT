"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AccountPrimaryButton } from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { adminApiFetch, parseAdminApiBody } from "@/lib/admin-api-fetch";

const LOGIN_BG = "/gallery/FTPR_18.JPG";

export default function AdminForgotPasswordPage() {
  const notify = usePortalAuthNotify();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      const res = await adminApiFetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const parsed = await parseAdminApiBody<{ message?: string }>(res, { redirectOn401: false });
      if (!parsed.ok) {
        notify.error(parsed.message, { duration: 7000, status: res.status });
        return;
      }
      notify.success("Reset link sent to your email if it matches the administrator address.", { duration: 6500 });
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
              <h1 className="admin-login-form-title">Recover access</h1>
              <p className="admin-login-form-lead">We&apos;ll email a single-use link to your administrator address.</p>
            </div>
            <form className="admin-login-form" onSubmit={(e) => void submit(e)} noValidate>
              <div className="admin-login-field">
                <label className="admin-login-label" htmlFor="admin-forgot-email">
                  Admin email
                </label>
                <input
                  id="admin-forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="admin-login-input"
                  disabled={busy}
                />
              </div>
              <div className="admin-login-actions-row">
                <AccountPrimaryButton busy={busy} disabled={!email.trim()}>
                  Send reset link
                </AccountPrimaryButton>
              </div>
              <p className="admin-login-foot-link">
                <Link href="/admin/login" className="ks-text-link">
                  Back to sign in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
