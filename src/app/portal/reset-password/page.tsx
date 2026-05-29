"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  AccountPrimaryButton,
  PasswordChangeFields
} from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { validatePasswordStrength } from "@/lib/password-strength";

const HERO_IMAGE = "/amahoro-stadium-hero.png";

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const notify = usePortalAuthNotify();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    const v = validatePasswordStrength(newPassword);
    return Boolean(token) && v.ok && newPassword === confirmPassword;
  }, [confirmPassword, newPassword, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
      const raw = await res.text();
      let msg = "";
      try {
        const j = JSON.parse(raw) as { message?: string };
        msg = j.message ?? raw;
      } catch {
        msg = raw || "Something went wrong.";
      }
      if (!res.ok) {
        notify.error(msg, { duration: 7600 });
        return;
      }
      notify.success("Password saved.", { duration: 4200 });
      window.setTimeout(() => router.push("/portal/login?fresh=1"), 620);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-auth-bleed" aria-labelledby="portal-reset-title">
      <div className="portal-auth-bleed-bg" aria-hidden>
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={95}
          className="portal-auth-bleed-img portal-auth-bleed-img--crisp"
        />
        <div className="portal-auth-bleed-overlay" />
      </div>

      <div className="portal-auth-bleed-grid portal-auth-bleed-grid--single">
        <div className="portal-auth-panel portal-auth-panel--narrow">
          <header className="portal-auth-panel-head">
            <h1 id="portal-reset-title" className="portal-auth-panel-title">
              Choose a new password
            </h1>
            <p className="portal-auth-panel-sub">
              Eight or more characters, with at least one letter and one number.
            </p>
          </header>
          {!token ? (
            <p className="form-message">
              Missing reset token. Request a fresh link from{" "}
              <Link href="/portal/forgot-password" className="ks-text-link">
                forgot password
              </Link>
              .
            </p>
          ) : (
            <form className="portal-auth-form" onSubmit={(e) => void submit(e)} noValidate>
              <PasswordChangeFields
                showCurrent={false}
                busy={busy}
                currentPassword=""
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                onCurrentChange={() => {}}
                onNewChange={setNewPassword}
                onConfirmChange={setConfirmPassword}
                newId="portal-reset-new"
                confirmId="portal-reset-confirm"
              />
              <AccountPrimaryButton busy={busy} disabled={!canSubmit}>
                Save password
              </AccountPrimaryButton>
              <p className="portal-auth-panel-foot" style={{ textAlign: "center", marginBottom: 0 }}>
                <Link href="/portal/login" className="portal-auth-panel-link">
                  Sign in instead
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function PortalResetPasswordPage() {
  return (
    <Suspense fallback={<p className="muted portal-auth-loading">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
