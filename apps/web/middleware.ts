import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";

export const middleware: NextMiddleware = (request) => {
  const sessionCookie = request.cookies.get("better-auth.session_token");
  const { pathname } = request.nextUrl;
  const isAuthPage =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/check-email");

  // Redirect authenticated users away from auth pages
  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect old /login to new sign-in path
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const response = NextResponse.next();

  // Prevent browser disk cache for dashboard pages.
  // Without this, browser back serves stale HTML from disk cache,
  // causing React hydration to fail silently.
  if (pathname.startsWith("/dashboard")) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  return response;
};

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
