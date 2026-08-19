import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode as defaultEncode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "@/auth.config";
import {
  isLockedOut,
  registerFailure,
  registerSuccess,
} from "@/lib/login-rate-limit";
import {
  REMEMBER_ME_MAX_AGE_SECONDS,
  resolveSessionMaxAge,
} from "@/lib/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    // Ceiling used by the cookie writer; the "تذكرني" checkbox further
    // shortens the *token's own* exp when unchecked (see jwt.encode below),
    // so the session functionally expires sooner even if the cookie file
    // physically persists.
    maxAge: REMEMBER_ME_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const remember = credentials?.remember === "true";
        if (!email || !password) return null;

        // Brute-force lockout: 5 consecutive failures → 15-minute block.
        if (isLockedOut(email)) return null;

        const db = getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user) {
          registerFailure(email);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          registerFailure(email);
          return null;
        }

        registerSuccess(email);
        const role = user.role === "employee" ? "employee" : "admin";
        return {
          id: String(user.id),
          email: user.email,
          name: role === "admin" ? "مدير النظام" : "موظف",
          remember,
          role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.remember = user.remember ?? false;
        token.role = user.role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? "admin";
      }
      return session;
    },
  },
  jwt: {
    encode: async (params) => {
      const maxAge = resolveSessionMaxAge(Boolean(params.token?.remember));
      return defaultEncode({ ...params, maxAge });
    },
  },
});
