"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";

/** Gallery hero for login backdrop (transparent overlays in CSS). Change file to swap photo. */
const LOGIN_BG = "/gallery/FTPR_18.JPG";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await adminApiFetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    let data: { message?: string } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text) as { message?: string };
    } catch {
      /* non-JSON body */
    }

    setLoading(false);
    if (!res.ok) {
      setMessage(data.message ?? "Login failed");
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" aria-hidden>
        <Image
          src={LOGIN_BG}
          alt=""
          fill
          className="admin-login-bg-image"
          sizes="100vw"
          priority
          quality={80}
        />
        <div className="admin-login-bg-veil" />
        <div className="admin-login-bg-accent" />
      </div>

      <div className="admin-login-page-inner">
        <div className="admin-login-shell">
          <div className="admin-login-brand-col">
            <div className="admin-login-logo-wrap">
              <Image
                src="/ftpr-admin-logo.svg"
                alt="FTPR Lions Academy"
                width={420}
                height={150}
                className="admin-login-logo-img"
                priority
              />
            </div>
            <p className="admin-login-brand-tagline">Football academy operations &amp; player management</p>
          </div>

          <div className="admin-login-form-col">
            <div className="admin-login-form-head">
              <h1 className="admin-login-form-title">Admin</h1>
              <p className="admin-login-form-lead">Sign in with your administrator credentials.</p>
            </div>

            <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
              <div className="admin-login-field">
                <label className="admin-login-label" htmlFor="admin-email">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="admin-login-input"
                  placeholder="you@organization.com"
                />
              </div>
              <div className="admin-login-field">
                <label className="admin-login-label" htmlFor="admin-password">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-login-input"
                  placeholder="••••••••"
                />
              </div>

              {message ? (
                <p className="admin-login-error" role="alert">
                  {message}
                </p>
              ) : null}

              <button type="submit" className="admin-login-submit" disabled={loading}>
                {loading ? "Signing in…" : "Continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
