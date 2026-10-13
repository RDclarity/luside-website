import { createClient } from "npm:@supabase/supabase-js@2";
import { handlePreflight, json } from "../_shared/cors.ts";
import { allow, clientIp } from "../_shared/ratelimit.ts";

// Leistungsfolder gegen E-Mail-Adresse: speichert die Anfrage (public.folder_requests),
// meldet sie per E-Mail ans Team und gibt einen 10 Minuten gültigen,
// signierten Download-Link auf das private PDF im Storage-Bucket "downloads" zurück.
//
//   { email, consent: true, lang: 'de'|'en', page }  → { ok, url }
//
// Secrets: RESEND_API_KEY, optional MAIL_FROM_INFO, MAIL_NOTIFY.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM_INFO") ?? "Lusides <inquiry@lusides.com>";
const NOTIFY_TO = [...new Set([...(Deno.env.get("MAIL_NOTIFY") ?? "inquiry@lusides.com").split(","), "rd@rimaequity.com", "mk@rimaequity.com"]
  .map((x) => x.trim().toLowerCase()).filter(Boolean))];

const BUCKET = "downloads";
const FILE = "Lusides_Leistungsfolder_A4.pdf";
const DOWNLOAD_NAME = "Lusides-Leistungsfolder.pdf";
// Ausweichadresse auf der Website (nicht verlinkt), falls der Storage-Dienst nicht erreichbar ist
const FALLBACK_URL = "https://lusides.com/dl/lusides-leistungsfolder-c74223c8b90b877952d06f56.pdf";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const pre = handlePreflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 254);
  const lang = b.lang === "en" ? "en" : "de";
  const page = String(b.page ?? "").slice(0, 200) || null;
  if (b.consent !== true) return json({ error: "consent_required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "invalid_email" }, 400);

  if (!(await allow(`folder:ip:${clientIp(req)}`, 10))) return json({ error: "rate_limited" }, 429);

  try {
    const { data: row, error } = await admin.from("folder_requests")
      .insert({ email, lang, page, consent_at: new Date().toISOString() }).select("id, created_at").single();
    if (error || !row) throw error ?? new Error("insert failed");

    let url = FALLBACK_URL;
    try {
      const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(FILE, 600, { download: DOWNLOAD_NAME });
      if (!sErr && signed?.signedUrl) url = signed.signedUrl;
      else console.error("signed url failed, using fallback", sErr);
    } catch (e) { console.error("storage unavailable, using fallback", e); }

    // Team informieren (Rückruf) – Fehler hier blockieren den Download nicht
    let mail = "fehler";
    try {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
      const when = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at));
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: MAIL_FROM, to: NOTIFY_TO, reply_to: email,
          subject: `Leistungsfolder heruntergeladen: ${email}`,
          html: `<p style="font:15px/1.6 Arial,sans-serif">Jemand hat am ${esc(when)} den Leistungsfolder auf lusides.com heruntergeladen und der Kontaktaufnahme per E-Mail zugestimmt.</p>
            <p style="font:18px/1.5 Arial,sans-serif"><strong><a href="mailto:${esc(email)}">${esc(email)}</a></strong></p>
            <p style="font:13px/1.6 Arial,sans-serif;color:#56677F">Sprache der Website: ${lang === "en" ? "Englisch (USA)" : "Deutsch"}${page ? ` · Seite: ${esc(page)}` : ""}. Alle Anfragen im Admin unter „Folder“.</p>`,
        }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
      mail = "gesendet";
    } catch (e) { console.error("folder notify failed", e); }
    await admin.from("folder_requests").update({ mail_status: mail }).eq("id", row.id);

    return json({ ok: true, url });
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
