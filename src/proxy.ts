import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Session guard for every route except /login and the Auth.js endpoints.
 * (Next.js 16 renamed middleware.ts to proxy.ts — same contract.)
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith("/api/auth")) return;

  if (pathname.startsWith("/api")) {
    if (!isLoggedIn) {
      return Response.json({ error: "غير مصرح" }, { status: 401 });
    }
    return;
  }

  if (pathname === "/login") {
    if (isLoggedIn) {
      return Response.redirect(new URL("/", req.nextUrl));
    }
    return;
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    return Response.redirect(loginUrl);
  }
});

// Static assets the browser fetches without a session must stay public:
// the push service worker, the PWA manifest and its PNG icons.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.svg$|.*\\.png$).*)",
  ],
};
