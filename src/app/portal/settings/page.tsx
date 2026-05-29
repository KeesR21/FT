"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  AccountPrimaryButton,
  PasswordChangeFields
} from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { validatePasswordStrength } from "@/lib/password-strength";

export default function PortalSettingsPage() {
  const router = useRouter();
  const notify = usePortalAuthNotify();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingProfile(true);
    fetch("/api/portal/auth/me", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          router.push("/portal/login");
          return;
        }
        const data = await r.json();
        if (!data?.authenticated || !alive) return;
        setEmail(String(data.account?.email ?? ""));
        setFullName(String(data.account?.fullName ?? ""));
        setHasPassword(Boolean(data.account?.hasPassword));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingProfile(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  const canSubmitPw = useMemo(() => {
    const s = validatePasswordStrength(newPassword);
    return (
      hasPassword &&
      currentPassword.length > 0 &&
      s.ok &&
      newPassword === confirmPassword &&
      newPassword.length > 0
    );
  }, [currentPassword, confirmPassword, hasPassword, newPassword]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPw || pwBusy) return;
    setPwBusy(true);
    try {
      const res = await fetch("/api/portal/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
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
        notify.error(msg, { duration: 7200 });
        return;
      }
      notify.success("Password updated successfully.", { duration: 4200 });
      window.setTimeout(() => {
        router.push("/portal/login?fresh=1");
        router.refresh();
      }, 550);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="portal-settings page-stack">
      <header className="portal-settings__head">
        <h1 className="portal-settings__title">Account &amp; security</h1>
        <p className="muted">
          Your portal uses the same email the academy has on file. Changing your password signs you out everywhere — sign
          back in with the new one.
        </p>
      </header>

      <section className="portal-settings__card card">
        <h2 className="portal-settings__card-title">Profile</h2>
        {loadingProfile ? <p className="muted">Loading…</p> : (
          <dl className="portal-settings__dl">
            <div>
              <dt>Name</dt>
              <dd>
                <input
                  className={clsx("input-field", "portal-settings__ro")}
                  value={fullName}
                  readOnly
                  aria-readonly
                />
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <input className={clsx("input-field", "portal-settings__ro")} value={email} readOnly aria-readonly />
              </dd>
            </div>
          </dl>
        )}
        <p className="muted portal-settings__note">Name and email updates go through the academy office.</p>
      </section>

      <section className="portal-settings__card card">
        <h2 className="portal-settings__card-title">Password</h2>
        {!loadingProfile && !hasPassword ? (
          <p className="form-message portal-settings__google-note">
            This account signs in with Google or has no portal password yet. Use{" "}
            <Link href="/portal/forgot-password" className="ks-text-link">
              Forgot password
            </Link>{" "}
            on the login screen to receive a secure link and choose a password.
          </p>
        ) : null}

        {!loadingProfile && hasPassword ? (
          <form className="portal-settings-pw-form" onSubmit={(e) => void changePassword(e)} noValidate>
            <PasswordChangeFields
              showCurrent
              busy={pwBusy}
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onCurrentChange={setCurrentPassword}
              onNewChange={setNewPassword}
              onConfirmChange={setConfirmPassword}
              currentId="portal-pw-current"
              newId="portal-pw-new"
              confirmId="portal-pw-confirm"
            />
            <div className="portal-settings-pw-actions">
              <AccountPrimaryButton busy={pwBusy} disabled={!canSubmitPw}>
                Update password &amp; sign out
              </AccountPrimaryButton>
              <Link href="/portal/forgot-password" className="portal-settings__text-link">
                Forgot password instead?
              </Link>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
