"use client";

import clsx from "clsx";
import { PortalAuthButtonSpinner } from "@/components/portal/portal-auth-notify";
import { validatePasswordStrength } from "@/lib/password-strength";

export type PasswordChangeFieldsProps = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentChange: (v: string) => void;
  onNewChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  /** When false, hides current password (e.g. email reset flow). */
  showCurrent: boolean;
  busy: boolean;
  currentId?: string;
  newId?: string;
  confirmId?: string;
  autoCompleteCurrent?: string;
};

export function PasswordChangeFields({
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentChange,
  onNewChange,
  onConfirmChange,
  showCurrent,
  busy,
  currentId = "pw-current",
  newId = "pw-new",
  confirmId = "pw-confirm",
  autoCompleteCurrent = "current-password"
}: PasswordChangeFieldsProps) {
  const strength = validatePasswordStrength(newPassword);
  const confirmErr = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const newErr = newPassword.length > 0 && !strength.ok ? strength.reason : "";

  return (
    <div className="account-pw-stack">
      {showCurrent ? (
        <label className="account-pw-field" htmlFor={currentId}>
          <span className="account-pw-label">Current password</span>
          <input
            id={currentId}
            type="password"
            autoComplete={autoCompleteCurrent}
            className={clsx("account-pw-input")}
            value={currentPassword}
            disabled={busy}
            onChange={(e) => onCurrentChange(e.target.value)}
          />
        </label>
      ) : null}
      <label className="account-pw-field" htmlFor={newId}>
        <span className="account-pw-label">New password</span>
        <input
          id={newId}
          type="password"
          autoComplete="new-password"
          className={clsx("account-pw-input", newErr && "account-pw-input--invalid")}
          value={newPassword}
          disabled={busy}
          onChange={(e) => onNewChange(e.target.value)}
          aria-invalid={Boolean(newErr)}
          aria-describedby={newErr ? `${newId}-err` : `${newId}-hint`}
        />
        <p id={`${newId}-hint`} className="account-pw-hint">
          At least 8 characters, including one letter and one number.
        </p>
        {newErr ? (
          <p id={`${newId}-err`} className="account-pw-inline-err" role="alert">
            {newErr}
          </p>
        ) : null}
      </label>
      <label className="account-pw-field" htmlFor={confirmId}>
        <span className="account-pw-label">Confirm new password</span>
        <input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          className={clsx("account-pw-input", confirmErr && "account-pw-input--invalid")}
          value={confirmPassword}
          disabled={busy}
          onChange={(e) => onConfirmChange(e.target.value)}
          aria-invalid={confirmErr}
        />
        {confirmErr ? (
          <p className="account-pw-inline-err" role="alert">
            New password and confirmation do not match.
          </p>
        ) : null}
      </label>
    </div>
  );
}

export function AccountPrimaryButton({
  children,
  busy,
  disabled,
  type = "submit"
}: {
  children: React.ReactNode;
  busy: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
}) {
  return (
    <button type={type} className="account-pw-submit" disabled={disabled || busy} aria-busy={busy}>
      {busy ? (
        <>
          <PortalAuthButtonSpinner />
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}
