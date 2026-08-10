"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function login(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      remember: formData.get("remember") === "on" ? "true" : "false",
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
    }
    throw error;
  }
  return undefined;
}
