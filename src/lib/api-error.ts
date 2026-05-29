export type ApiErrorSurface = "admin" | "portal" | "public";

export type FormatApiErrorOptions = {
  surface?: ApiErrorSurface;
  /** Do not map 401 to session-expired (e.g. login form). */
  isLoginRequest?: boolean;
};

type JsonErrorBody = {
  message?: unknown;
  error?: unknown;
};

/** Parse `{ message }` / `{ error }` from an API response body without exposing raw JSON. */
export function extractApiMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as JsonErrorBody;
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    /* plain text body */
  }

  if (trimmed.startsWith("{") && trimmed.includes('"message"')) {
    return "";
  }

  return trimmed;
}

function isTechnicalMessage(message: string): boolean {
  const msg = message.trim();
  if (!msg) return false;
  if (/^\s*\{[\s\S]*\}\s*$/.test(msg)) return true;
  if (/^\s*\[[\s\S]*\]\s*$/.test(msg)) return true;
  if (/at\s+\S+\s+\(.+\:\d+\:\d+\)/.test(msg)) return true;
  if (/^(Unauthorized|Forbidden|Not Found|Bad Request|Internal Server Error)$/i.test(msg)) {
    return true;
  }
  if (/sql|syntax error|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Unexpected token/i.test(msg)) return true;
  return false;
}

/** Map HTTP status + backend message to a safe, user-facing string. */
export function formatApiErrorMessage(
  status: number,
  rawMessage: string,
  options: FormatApiErrorOptions = {}
): string {
  const surface = options.surface ?? "admin";
  let msg = rawMessage.trim();

  if (msg.startsWith("{") && msg.includes('"message"')) {
    msg = extractApiMessage(msg);
  }

  if (status === 401 || /^unauthorized$/i.test(msg)) {
    if (options.isLoginRequest) {
      return "Invalid email or password. Please check your details and try again.";
    }
    if (/session expired|inactivity|sign in again/i.test(msg)) {
      return msg;
    }
    return surface === "portal"
      ? "Your session has expired. Please sign in again."
      : "Your session has expired. Please sign in again.";
  }

  if (status === 403 || /^forbidden$/i.test(msg)) {
    return "You don't have permission to perform this action.";
  }

  if (status === 404 || /^not found$/i.test(msg)) {
    return "We couldn't find what you were looking for.";
  }

  if (status === 409) {
    return msg && !isTechnicalMessage(msg)
      ? msg
      : "This action conflicts with existing data. Please refresh and try again.";
  }

  if (status === 422) {
    return msg && !isTechnicalMessage(msg) ? msg : "Please check your input and try again.";
  }

  if (status === 429) {
    return msg && !isTechnicalMessage(msg)
      ? msg
      : "Too many requests. Please wait a moment and try again.";
  }

  if (status >= 500 || /internal server error/i.test(msg)) {
    return "Something went wrong on our side. Please try again shortly.";
  }

  if (status === 400) {
    if (/invalid login payload|expected json/i.test(msg)) {
      return "Please check your details and try again.";
    }
    if (msg && !isTechnicalMessage(msg)) return msg;
    return "Please check your input and try again.";
  }

  if (status === 0) {
    return msg && !isTechnicalMessage(msg)
      ? msg
      : "Unable to connect. Please check your internet connection.";
  }

  if (isTechnicalMessage(msg)) {
    return "Something went wrong. Please try again.";
  }

  return msg || "Something went wrong. Please try again.";
}

/** Sanitize any string before showing in UI (toasts, notices, inline errors). */
export function sanitizeDisplayMessage(message: string, status = 0, surface: ApiErrorSurface = "admin"): string {
  const trimmed = message.trim();
  if (!trimmed) return formatApiErrorMessage(status, "", { surface });

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const extracted = extractApiMessage(trimmed);
    return formatApiErrorMessage(status, extracted, { surface });
  }

  if (isTechnicalMessage(trimmed)) {
    return formatApiErrorMessage(status, trimmed, { surface });
  }

  return formatApiErrorMessage(status, trimmed, { surface });
}

export function formatNetworkError(err: unknown, surface: ApiErrorSurface = "admin"): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }
  if (err instanceof TypeError) {
    return "Unable to connect. Please check your internet connection.";
  }
  if (err instanceof Error) {
    return sanitizeDisplayMessage(err.message, 0, surface);
  }
  return "Something went wrong. Please try again.";
}
