"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import {
  ADMIN_LOGIN_SLOW_HINT_MS,
  ADMIN_LOGIN_TIMEOUT_MS,
  submitAdminLogin,
  validateAdminLoginInput,
  type AdminLoginFieldErrors
} from "@/lib/admin-login-client";
import { resetAdminSessionRedirectGuard } from "@/lib/admin-api-fetch";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return <span className="al-spinner" aria-hidden />;
}

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const notify = usePortalAuthNotify();
  const formErrorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminLoginFieldErrors>({});
  const [slowHint, setSlowHint] = useState(false);
  const [shake, setShake] = useState(false);

  const submittedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resetAdminSessionRedirectGuard();
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchParams.get("fresh") === "1") {
      notify.success("Password updated — sign in with your new password.", { duration: 7000 });
    }
    if (searchParams.get("reason") === "timeout") {
      notify.warning("Your session expired. Please sign in again.", { duration: 7000 });
    }
  }, [notify, searchParams]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const clearErrors = useCallback(() => {
    setFormError("");
    setFieldErrors({});
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittedRef.current || busy || success) return;

    const validation = validateAdminLoginInput(email, password);
    if (validation.formError) {
      setFieldErrors(validation.fieldErrors);
      setFormError(validation.formError);
      triggerShake();
      return;
    }

    submittedRef.current = true;
    setBusy(true);
    clearErrors();
    setSlowHint(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => controller.abort(), ADMIN_LOGIN_TIMEOUT_MS);
    const slowHintId = window.setTimeout(() => setSlowHint(true), ADMIN_LOGIN_SLOW_HINT_MS);

    let ok = false;
    try {
      const result = await submitAdminLogin(email, password, { signal: controller.signal });

      if (!result.ok) {
        setFormError(result.message);
        triggerShake();
        return;
      }

      ok = true;
      setSuccess(true);
      setSlowHint(false);

      // Hard replace — fastest path: bypasses Next.js client router overhead on first auth load
      window.setTimeout(() => {
        window.location.replace("/admin/dashboard");
      }, 320);
    } finally {
      window.clearTimeout(timeoutId);
      window.clearTimeout(slowHintId);
      if (!ok) {
        setBusy(false);
        setSlowHint(false);
        submittedRef.current = false;
      }
    }
  };

  const isLocked = busy || success;

  let btnContent: React.ReactNode;
  if (success) {
    btnContent = <><CheckIcon /> Signed in</>;
  } else if (slowHint) {
    btnContent = <><SpinnerIcon /> Taking a moment…</>;
  } else if (busy) {
    btnContent = <><SpinnerIcon /> Signing in…</>;
  } else {
    btnContent = "Log in";
  }

  return (
    <form
      className={clsx(
        "al-form",
        shake && "al-form--shake",
        success && "al-form--success"
      )}
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      aria-busy={isLocked}
    >
      {/* Email */}
      <div className={clsx("al-field", fieldErrors.email && "al-field--invalid")}>
        <label className="al-label" htmlFor="al-email">Email</label>
        <input
          ref={emailRef}
          id="al-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            if (formError) setFormError("");
          }}
          className="al-input"
          placeholder="admin@ftprlions.com"
          disabled={isLocked}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${formErrorId}-em` : undefined}
        />
        {fieldErrors.email && (
          <p className="al-field-err" id={`${formErrorId}-em`} role="alert">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className={clsx("al-field", fieldErrors.password && "al-field--invalid")}>
        <div className="al-label-row">
          <label className="al-label" htmlFor="al-password">Password</label>
          <Link
            href="/admin/forgot-password"
            className="al-forgot"
            tabIndex={isLocked ? -1 : undefined}
          >
            Forgot password?
          </Link>
        </div>
        <div className="al-input-wrap">
          <input
            id="al-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              if (formError) setFormError("");
            }}
            className="al-input al-input--pw"
            placeholder="••••••••"
            disabled={isLocked}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? `${formErrorId}-pw` : undefined}
          />
          <button
            type="button"
            className="al-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            disabled={isLocked}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {fieldErrors.password && (
          <p className="al-field-err" id={`${formErrorId}-pw`} role="alert">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {/* Form-level error */}
      {formError && !fieldErrors.email && !fieldErrors.password && (
        <div className="al-error" id={formErrorId} role="alert">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {formError}
        </div>
      )}

      {/* Slow-network hint (no duplicate with button label) */}
      {slowHint && !formError && (
        <p className="al-slow" role="status" aria-live="polite">
          Still connecting — please wait…
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        className={clsx(
          "al-submit",
          busy && !success && "al-submit--busy",
          success && "al-submit--success"
        )}
        disabled={isLocked}
        aria-busy={busy && !success}
      >
        {btnContent}
      </button>
    </form>
  );
}
