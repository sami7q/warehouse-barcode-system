import type { NextAuthConfig } from "next-auth";

/**
 * Base Auth.js config, safe to import from the proxy (no DB / bcrypt).
 * The Credentials provider is added in src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
