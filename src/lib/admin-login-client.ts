import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { formatApiErrorMessage, formatNetworkError } from "@/lib/api-error";

export const ADMIN_LOGIN_TIMEOUT_MS = 20_000;
export const ADMIN_LOGIN_SLOW_HINT_MS = 5_000;
/** @deprecated redirect is now handled via window.location.replace in the form */
export const ADMIN_LOGIN_REDIRECT_DELAY_MS = 320;

export type AdminLoginErrorKind =
  | "validation"
  | "credentials"
  | "network"
  | "timeout"
  | "server"
  | "rate_limit";

export type AdminLoginResult =
  | { ok: true }
  | { ok: false; message: string; kind: AdminLoginErrorKind };

export type AdminLoginFieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAdminLoginInput(
  email: string,
  password: string
): { formError?: string; fieldErrors: AdminLoginFieldErrors } {
  const trimmedEmail = email.trim();
  const fieldErrors: AdminLoginFieldErrors = {};

  if (!trimmedEmail) {
    fieldErrors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  const firstFieldError = fieldErrors.email ?? fieldErrors.password;
  return { formError: firstFieldError, fieldErrors };
}

/** @deprecated Use formatApiErrorMessage from `@/lib/api-error`. */
export function mapAdminLoginError(status: number, message?: string): string {
  return formatApiErrorMessage(status, message?.trim() ?? "", {
    surface: "admin",
    isLoginRequest: true
  });
}

export async function submitAdminLogin(
  email: string,
  password: string,
  options?: { signal?: AbortSignal }
): Promise<AdminLoginResult> {
  const validation = validateAdminLoginInput(email, password);
  if (validation.formError) {
    return { ok: false, message: validation.formError, kind: "validation" };
  }

  try {
    const res = await adminApiFetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      signal: options?.signal
    });

    if (!res.ok) {
      const kind: AdminLoginErrorKind =
        res.status === 401
          ? "credentials"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "server"
              : "validation";

      return {
        ok: false,
        message: await readAdminApiError(res, { isLoginRequest: true, redirectOn401: false }),
        kind
      };
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        message: "The sign-in request timed out. Check your connection and try again.",
        kind: "timeout"
      };
    }
    return {
      ok: false,
      message: formatNetworkError(err, "admin"),
      kind: "network"
    };
  }
}
