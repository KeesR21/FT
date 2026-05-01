import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Forward pathname so server components can branch admin vs public without client `usePathname()` (avoids SSR null / wrong shell). */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
