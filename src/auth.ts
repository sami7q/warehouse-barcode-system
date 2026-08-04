import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
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
        return { id: String(user.id), email: user.email, name: "مدير النظام" };
      },
    }),
  ],
});
