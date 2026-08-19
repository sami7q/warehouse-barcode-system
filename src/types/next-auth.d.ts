import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

export type UserRole = "admin" | "employee";

declare module "next-auth" {
  interface User {
    remember?: boolean;
    role?: UserRole;
  }
  interface Session {
    user: {
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    remember?: boolean;
    role?: UserRole;
  }
}
