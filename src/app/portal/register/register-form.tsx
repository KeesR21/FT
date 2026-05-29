"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { PortalAuthButtonSpinner, usePortalAuthNotify } from "@/components/portal/portal-auth-notify";

function evaluateStrength(pwd: string): { label: string; tone: "weak" | "ok" | "strong"; pct: number } {
  if (!pwd) return { label: "—", tone: "weak", pct: 0 };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Za-z]/.test(pwd) && /\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  if (score <= 1) return { label: "Weak", tone: "weak", pct: 25 };
  if (score === 2) return { label: "OK", tone: "ok", pct: 60 };
  return { label: "Strong", tone: "strong", pct: 100 };
}

const REGISTER_REDIRECT_MS = 1600;

export function RegisterForm({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const notify = usePortalAuthNotify();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submittedRef = useRef(false);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const strength = evaluateStrength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittedRef.current || busy) return;
    if (password !== confirm) {
      notify.warning("Passwords do not match.");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      notify.warning("Password must be at least 8 characters and include a letter and a number.");
      return;
    }
    submittedRef.current = true;
    setBusy(true);
    let leaveLocked = false;
    try {
      const res = await fetch("/api/portal/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password }),
        credentials: "include"
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        notify.error(data?.message ?? "Registration failed. Please try again.");
        return;
      }
      const msg =
        data?.message ?? "Account created successfully. Please log in to continue.";
      leaveLocked = true;
      notify.success(msg, { duration: 8000 });
      window.setTimeout(() => {
        router.push("/portal/login");
        router.refresh();
      }, REGISTER_REDIRECT_MS);
    } catch {
      notify.error("Something went wrong. Check your connection and try again.");
    } finally {
      if (!leaveLocked) {
        setBusy(false);
        submittedRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (!googleClientId) return;
    const clientId: string = googleClientId;
    if (typeof window === "undefined") return;
    function init() {
      const w = window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (opts: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
              renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
            };
          };
        };
      };
      if (!w.google?.accounts?.id || !googleBtnRef.current) return;
      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          if (!resp.credential) return;
          if (submittedRef.current) return;
          submittedRef.current = true;
          setBusy(true);
          let leaveLocked = false;
          try {
            const r = await fetch("/api/portal/auth/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ credential: resp.credential }),
              credentials: "include"
            });
            const d = (await r.json().catch(() => ({}))) as { message?: string };
            if (!r.ok) {
              notify.error(d?.message ?? "Google sign-up failed.");
              return;
            }
            leaveLocked = true;
            notify.success("Welcome! Redirecting to your dashboard…", { duration: 6000 });
            window.setTimeout(() => {
              router.push("/portal/dashboard");
              router.refresh();
            }, 720);
          } catch {
            notify.error("Google sign-up failed. Please try again.");
          } finally {
            if (!leaveLocked) {
              setBusy(false);
              submittedRef.current = false;
            }
          }
        }
      });
      w.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signup_with",
        width: 320
      });
    }
    const id = "google-identity-services";
    if (document.getElementById(id)) {
      init();
    } else {
      const s = document.createElement("script");
      s.id = id;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
    }
  }, [googleClientId, notify, router]);

  return (
    <>
      {googleClientId ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" /> : null}
      <form onSubmit={submit} className="portal-auth-form" aria-busy={busy} noValidate>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Full Name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
            minLength={2}
            placeholder="Your full name"
            className="portal-auth-input"
            disabled={busy}
          />
        </label>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Email Address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="Email the academy already has on file"
            className="portal-auth-input"
            disabled={busy}
          />
        </label>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters · letters + numbers"
            className="portal-auth-input"
            disabled={busy}
          />
          <div className={`portal-strength portal-strength--${strength.tone}`} aria-hidden>
            <span style={{ width: `${strength.pct}%` }} />
          </div>
          <small className="portal-auth-hint">
            Strength: <strong>{strength.label}</strong> · minimum 8 characters with a letter and a number.
          </small>
        </label>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Confirm Password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            className="portal-auth-input"
            disabled={busy}
          />
        </label>

        <div
          className={clsx("portal-auth-actions", busy && "portal-auth-actions--busy")}
          role="group"
          aria-label="Create account or sign in"
        >
          <button type="submit" className="btn" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <PortalAuthButtonSpinner />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
          <Link href="/portal/login" className="btn btn-secondary" tabIndex={busy ? -1 : undefined}>
            Sign in
          </Link>
        </div>
      </form>

      {googleClientId ? (
        <>
          <div className="portal-auth-divider">
            <span>or</span>
          </div>
          <div className={clsx("portal-auth-google", busy && "portal-auth-actions--busy")} aria-disabled={busy}>
            <div ref={googleBtnRef} aria-label="Sign up with Google" />
          </div>
        </>
      ) : null}
    </>
  );
}
