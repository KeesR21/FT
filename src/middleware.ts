import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Inlined here (not imported from auth.ts) to keep the middleware in the Edge Runtime.
// Must stay in sync with ADMIN_COOKIE in src/lib/auth.ts.
const ADMIN_COOKIE = "academy_admin_session";

/**
 * Single middleware entry-point.
 *
 * Responsibilities:
 *  1. Forward `x-pathname` so server components / layouts can branch
 *     admin vs public chrome without `usePathname()` (avoids SSR null).
 *  2. Guard admin routes: redirect to /admin/login when no session cookie
 *     is present; redirect to /admin/dashboard when logged-in user visits
 *     the login page.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin route protection ---
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get(ADMIN_COOKIE)?.value;
    const isPublicAdminRoute =
      pathname === "/admin/login" ||
      pathname.startsWith("/admin/forgot-password") ||
      pathname.startsWith("/admin/reset-password");

    if (!isPublicAdminRoute && !session) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Forward pathname header to layouts ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimizer)
     *  - favicon.ico
     *  - public static files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)"
  ]
};
