// Admin login rate limit: 5 failed tries per IP per 15 minutes
// (login_attempts table, 0009_activity_fields.sql). If the table can't be
// read, login still works (the limit is an extra layer, not the lock).

import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";

export const MAX_FAILED_LOGINS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function clientIp(request: NextRequest): string {
  // Behind Vercel the real client IP is the first entry in x-forwarded-for.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function tooManyFailedLogins(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("at", since);
  if (error) {
    console.error("login rate limit check failed:", error.message);
    return false;
  }
  return (count ?? 0) >= MAX_FAILED_LOGINS;
}

export async function recordLogin(ip: string, success: boolean) {
  const { error } = await supabaseAdmin.from("login_attempts").insert({ ip, success });
  if (error) console.error("login attempt not recorded:", error.message);
}
