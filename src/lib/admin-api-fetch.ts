import {
  extractApiMessage,
  formatApiErrorMessage,
  formatNetworkError,
  type FormatApiErrorOptions
} from "@/lib/api-error";

/**
 * Client-side fetch for admin UI — disables browser / heuristic HTTP cache for mutable JSON
 * (use for `/api/admin/**` and other session APIs such as `/api/registrations/**` from admin screens).
 * Pair with `ADMIN_OVERVIEW_REFRESH` (mutations + ~30s background poll) so other admin tabs refetch without signing out.
 */
export function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { credentials, ...rest } = init;
  return fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    cache: "no-store"
  });
}

const ADMIN_AUTH_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const ADMIN_SESSION_REDIRECT_KEY = "ftpr_admin_session_redirect";

let adminSessionRedirectPending = false;
/**
 * Counts consecutive 401s that arrived from background / silent polls.
 * We require at least 2 consecutive failures before treating them as a real
 * session expiry — this prevents a single transient file-lock or hot-reload
 * 401 from evicting an active admin.
 */
let backgroundAuthFailures = 0;
const BACKGROUND_AUTH_FAILURE_THRESHOLD = 2;

function isAdminAuthPath(path: string): boolean {
  return ADMIN_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Clear redirect guard after landing on a public admin auth screen. */
export function resetAdminSessionRedirectGuard(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_SESSION_REDIRECT_KEY);
  adminSessionRedirectPending = false;
  backgroundAuthFailures = 0;
}

function doSessionExpiredRedirect(): void {
  if (adminSessionRedirectPending) return;
  const path = window.location.pathname;
  if (isAdminAuthPath(path)) return;
  if (sessionStorage.getItem(ADMIN_SESSION_REDIRECT_KEY) === "1") return;

  adminSessionRedirectPending = true;
  sessionStorage.setItem(ADMIN_SESSION_REDIRECT_KEY, "1");

  void (async () => {
    try {
      await adminApiFetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* best-effort cookie clear */
    }
    window.location.replace("/admin/login?reason=timeout");
  })();
}

/**
 * Called when an explicit user-initiated admin API call (save, delete, etc.)
 * receives a 401 — triggers immediate sign-out redirect.
 */
export function handleAdminSessionExpired(): void {
  if (typeof window === "undefined") return;
  doSessionExpiredRedirect();
}

/**
 * Called when a background / silent poll (topbar badge refresh, etc.)
 * receives a 401. Requires {@link BACKGROUND_AUTH_FAILURE_THRESHOLD}
 * consecutive failures before triggering sign-out, so a single transient
 * I/O error or hot-reload does not evict an active admin.
 * Resets the counter on any successful response via {@link resetBackgroundAuthFailures}.
 */
export function handleBackgroundAuthFailure(): void {
  if (typeof window === "undefined") return;
  backgroundAuthFailures += 1;
  if (backgroundAuthFailures >= BACKGROUND_AUTH_FAILURE_THRESHOLD) {
    doSessionExpiredRedirect();
  }
}

/** Reset background failure counter after a successful authenticated response. */
export function resetBackgroundAuthFailures(): void {
  backgroundAuthFailures = 0;
}

export type ReadAdminApiErrorOptions = FormatApiErrorOptions & {
  redirectOn401?: boolean;
};

/** Read and sanitize an admin API error response body. */
export async function readAdminApiError(
  res: Response,
  options: ReadAdminApiErrorOptions = {}
): Promise<string> {
  const text = await res.text();
  const raw = extractApiMessage(text);
  const message = formatApiErrorMessage(res.status, raw, {
    surface: "admin",
    isLoginRequest: options.isLoginRequest
  });

  if (res.status === 401 && options.redirectOn401 !== false && !options.isLoginRequest) {
    handleAdminSessionExpired();
  }

  return message;
}

/** Throw a sanitized error when an admin API response is not OK. */
export async function assertAdminApiOk(res: Response, options: ReadAdminApiErrorOptions = {}): Promise<void> {
  if (!res.ok) {
    throw new Error(await readAdminApiError(res, options));
  }
}

export type AdminApiJsonResult<T> =
  | { ok: true; data: T; response: Response }
  | { ok: false; status: number; message: string };

/** JSON admin API helper with centralized error sanitization. */
export async function adminApiJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ReadAdminApiErrorOptions = {}
): Promise<AdminApiJsonResult<T>> {
  try {
    const response = await adminApiFetch(input, init);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: await readAdminApiError(response, options)
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, response };
  } catch (err) {
    return { ok: false, status: 0, message: formatNetworkError(err, "admin") };
  }
}

/** Read response body once — parse JSON on success or return a sanitized error. */
export async function parseAdminApiBody<T>(
  res: Response,
  options: ReadAdminApiErrorOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const text = await res.text();
  if (!res.ok) {
    const message = formatApiErrorMessage(res.status, extractApiMessage(text), {
      surface: "admin",
      isLoginRequest: options.isLoginRequest
    });
    if (res.status === 401 && options.redirectOn401 !== false && !options.isLoginRequest) {
      handleAdminSessionExpired();
    }
    return { ok: false, message };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, message: "We received an unexpected response. Please try again." };
  }
}

/** Format a message from an already-parsed JSON error payload. */
export function formatAdminApiMessage(status: number, message?: string | null): string {
  return formatApiErrorMessage(status, message?.trim() ?? "", { surface: "admin" });
}
