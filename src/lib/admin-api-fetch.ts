/**
 * Client-side fetch for admin UI — disables browser / heuristic HTTP cache for mutable JSON
 * (use for `/api/admin/**` and other session APIs such as `/api/registrations/**` from admin screens).
 * Pair with `ADMIN_OVERVIEW_REFRESH` so other admin tabs refetch in the same session.
 */
export function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { cache: _ignore, credentials, ...rest } = init;
  return fetch(input, {
    ...rest,
    credentials: credentials ?? "include",
    cache: "no-store"
  });
}
