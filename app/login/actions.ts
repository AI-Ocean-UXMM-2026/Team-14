"use server";
import { redirect } from "next/navigation";
import { publicConfigurationError } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
export type LoginState = { message: string };
export async function login(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  const configurationError = publicConfigurationError();
  if (configurationError) return { message: configurationError };
  const email = String(form.get("email") ?? "").trim(),
    password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 1024)
    return { message: "Enter a valid email address and password." };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        message: error.status === 429
          ? "Too many sign-in attempts. Please wait before trying again."
          : !error.status || error.status >= 500
            ? "Unable to reach school sign-in. Please try again shortly."
            : error.code === "email_not_confirmed"
              ? "Confirm your email before signing in. Contact your administrator if you need help."
              : "Email or password is incorrect, or your account is unavailable.",
      };
  } catch {
    return {
      message: "Unable to connect. Check your connection and try again.",
    };
  }
  // Roles and active membership are still resolved independently by the workspace.
  redirect("/workspace");
}
export async function logout() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/login");
}
