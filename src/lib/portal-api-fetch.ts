import {
  extractApiMessage,
  formatApiErrorMessage,
  formatNetworkError,
  type FormatApiErrorOptions
} from "@/lib/api-error";

export function portalApiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { credentials, ...rest } = init;
  return fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    cache: "no-store"
  });
}

const PORTAL_AUTH_PATHS = ["/portal/login", "/portal/register", "/portal/forgot-password", "/portal/reset-password"];
const PORTAL_SESSION_REDIRECT_KEY = "ftpr_portal_session_redirect";

let portalSessionRedirectPending = false;

function isPortalAuthPath(path: string): boolean {
  return PORTAL_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function resetPortalSessionRedirectGuard(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PORTAL_SESSION_REDIRECT_KEY);
  portalSessionRedirectPending = false;
}

export function handlePortalSessionExpired(): void {
  if (typeof window === "undefined") return;
  if (portalSessionRedirectPending) return;

  const path = window.location.pathname;
  if (isPortalAuthPath(path)) return;

  if (sessionStorage.getItem(PORTAL_SESSION_REDIRECT_KEY) === "1") return;

  portalSessionRedirectPending = true;
  sessionStorage.setItem(PORTAL_SESSION_REDIRECT_KEY, "1");

  void (async () => {
    try {
      await portalApiFetch("/api/portal/auth/logout", { method: "POST" });
    } catch {
      /* best-effort cookie clear */
    }
    window.location.replace("/portal/login?reason=timeout");
  })();
}

export type ReadPortalApiErrorOptions = FormatApiErrorOptions & {
  redirectOn401?: boolean;
};

export async function readPortalApiError(
  res: Response,
  options: ReadPortalApiErrorOptions = {}
): Promise<string> {
  const text = await res.text();
  const raw = extractApiMessage(text);
  const message = formatApiErrorMessage(res.status, raw, {
    surface: "portal",
    isLoginRequest: options.isLoginRequest
  });

  if (res.status === 401 && options.redirectOn401 !== false && !options.isLoginRequest) {
    handlePortalSessionExpired();
  }

  return message;
}

export async function assertPortalApiOk(res: Response, options: ReadPortalApiErrorOptions = {}): Promise<void> {
  if (!res.ok) {
    throw new Error(await readPortalApiError(res, options));
  }
}

export function formatPortalApiMessage(status: number, message?: string | null): string {
  return formatApiErrorMessage(status, message?.trim() ?? "", { surface: "portal" });
}

export type PortalApiJsonResult<T> =
  | { ok: true; data: T; response: Response }
  | { ok: false; status: number; message: string };

export async function portalApiJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ReadPortalApiErrorOptions = {}
): Promise<PortalApiJsonResult<T>> {
  try {
    const response = await portalApiFetch(input, init);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: await readPortalApiError(response, options)
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, response };
  } catch (err) {
    return { ok: false, status: 0, message: formatNetworkError(err, "portal") };
  }
}
