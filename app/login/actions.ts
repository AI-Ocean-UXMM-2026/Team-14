"use server";
import { redirect } from "next/navigation";
import { createClient, isConfigured } from "@/lib/supabase/server";
export type LoginState = { message: string };
export async function login(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  if (!isConfigured())
    return {
      message: "School sign-in is unavailable. Contact your administrator.",
    };
  const email = String(form.get("email") ?? "").trim(),
    password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 1024)
    return { message: "Enter a valid email address and password." };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        message:
          "Email or password is incorrect, or your account is unavailable.",
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
