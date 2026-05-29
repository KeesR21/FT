"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { PortalAuthButtonSpinner, usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { formatNetworkError } from "@/lib/api-error";
import { portalApiFetch, readPortalApiError, resetPortalSessionRedirectGuard } from "@/lib/portal-api-fetch";
import { PUBLIC_REGISTRATION_ENABLED } from "@/lib/site-features";

const REMEMBER_KEY = "ftpr_portal_remember_email";

const REDIRECT_AFTER_MS = 720;

export function LoginForm({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = usePortalAuthNotify();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittedRef = useRef(false);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        setEmail(stored);
        setRemember(true);
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  useEffect(() => {
    resetPortalSessionRedirectGuard();
  }, []);

  useEffect(() => {
    if (searchParams.get("fresh") === "1") {
      notify.success("Password updated — sign in with your new password.", { duration: 7500 });
    }
    if (searchParams.get("reason") === "timeout") {
      notify.warning("Your session expired. Please sign in again.", { duration: 7500 });
    }
  }, [searchParams, notify]);

  const redirectAfterLogin = useCallback(() => {
    window.setTimeout(() => {
      router.push("/portal/dashboard");
      router.refresh();
    }, REDIRECT_AFTER_MS);
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittedRef.current || busy) return;
    submittedRef.current = true;
    setBusy(true);
    let leaveLocked = false;
    try {
      const res = await portalApiFetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      if (!res.ok) {
        notify.error(await readPortalApiError(res, { isLoginRequest: true, redirectOn401: false }), {
          status: res.status
        });
        return;
      }
      try {
        if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim().toLowerCase());
        else window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
      leaveLocked = true;
      notify.success("Login successful. Redirecting…", { duration: 6000 });
      redirectAfterLogin();
    } catch (err) {
      notify.error(formatNetworkError(err, "portal"));
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
    const id = "google-identity-services";
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
            const r = await portalApiFetch("/api/portal/auth/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ credential: resp.credential })
            });
            if (!r.ok) {
              notify.error(await readPortalApiError(r, { isLoginRequest: true, redirectOn401: false }), {
                status: r.status
              });
              return;
            }
            leaveLocked = true;
            notify.success("Login successful. Redirecting…", { duration: 6000 });
            redirectAfterLogin();
          } catch (err) {
            notify.error(formatNetworkError(err, "portal"));
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
        text: "signin_with",
        width: 320
      });
    }
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
  }, [googleClientId, notify, redirectAfterLogin, router]);

  return (
    <>
      {googleClientId ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" /> : null}
      <form onSubmit={submit} className="portal-auth-form" aria-busy={busy} noValidate>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Email Address</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="parent@example.com"
            className="portal-auth-input"
            disabled={busy}
          />
        </label>
        <label className="portal-auth-field">
          <span className="portal-auth-field-label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="portal-auth-input"
            disabled={busy}
          />
        </label>

        <div className="portal-auth-row">
          <label className="portal-auth-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
            <span>Remember me</span>
          </label>
        </div>

        <div
          className={clsx("portal-auth-actions", busy && "portal-auth-actions--busy")}
          role="group"
          aria-label="Sign in or create an account"
        >
          <button type="submit" className="btn" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <PortalAuthButtonSpinner />
                Signing in…
              </>
            ) : (
              "Sign in now"
            )}
          </button>
          {PUBLIC_REGISTRATION_ENABLED ? (
            <Link href="/portal/register" className="btn btn-secondary" tabIndex={busy ? -1 : undefined}>
              Create an account
            </Link>
          ) : null}
        </div>

        <div className="portal-auth-secondary">
          <Link className="portal-auth-text-link" href="/portal/forgot-password">
            Forgot password?
          </Link>
        </div>
      </form>

      {googleClientId ? (
        <>
          <div className="portal-auth-divider">
            <span>or</span>
          </div>
          <div className={clsx("portal-auth-google", busy && "portal-auth-actions--busy")} aria-disabled={busy}>
            <div ref={googleBtnRef} aria-label="Sign in with Google" />
          </div>
        </>
      ) : null}
    </>
  );
}
