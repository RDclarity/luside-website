import { createClient } from "npm:@supabase/supabase-js@2";

// Einfache Missbrauchsbremse pro IP über public.hit_rate_limit()
// (Migration 20261003120000_security.sql). Fällt die Prüfung technisch aus,
// wird der Aufruf zugelassen (fail-open) und geloggt – die Website soll nicht
// wegen eines Zähler-Problems ausfallen.
const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim().slice(0, 64);
}

export async function allow(bucket: string, limit: number, window = "1 hour"): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("hit_rate_limit", { p_bucket: bucket, p_limit: limit, p_window: window });
    if (error) { console.error("rate limit check failed", error); return true; }
    return data === true;
  } catch (e) {
    console.error("rate limit check failed", e);
    return true;
  }
}
