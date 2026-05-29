"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AccountPrimaryButton } from "@/components/account/password-change-fields";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";

const HERO_IMAGE = "/amahoro-stadium-hero.png";

export default function PortalForgotPasswordPage() {
  const notify = usePortalAuthNotify();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const raw = await res.text();
      let msg =
        "If an account matches this email, you'll receive reset instructions shortly.";
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (j.message) msg = j.message;
      } catch {
        /* generic */
      }
      if (!res.ok) {
        notify.error(msg, { duration: 7000 });
        return;
      }
      notify.success("Reset link sent to your email if we found a portal account.", { duration: 7000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-auth-bleed" aria-labelledby="portal-forgot-title">
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
            <h1 id="portal-forgot-title" className="portal-auth-panel-title">
              Forgot password
            </h1>
            <p className="portal-auth-panel-sub">We&apos;ll email a secure link — it expires in 45 minutes.</p>
          </header>
          <form className="portal-auth-form" onSubmit={(e) => void submit(e)} noValidate>
            <label className="portal-auth-field">
              <span className="portal-auth-field-label">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="portal-auth-input"
                disabled={busy}
              />
            </label>
            <AccountPrimaryButton busy={busy} disabled={!email.trim()}>
              Send reset link
            </AccountPrimaryButton>
            <p className="portal-auth-panel-foot" style={{ textAlign: "center", marginBottom: 0 }}>
              <Link href="/portal/login" className="portal-auth-panel-link">
                Back to sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
