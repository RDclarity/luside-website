import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";
import { allow, clientIp } from "../_shared/ratelimit.ts";

// Public lead-intake for the Lusides website (main contact form + the
// seminar page's signup form). Forwards into RIMA Equity's shared CRM
// (contact_submissions, tagged source_company='lusides').
//
// Bewusst kein Shared Secret zum Browser hin nötig (wie bei
// lusides-chat): der Aufrufer kann hier nur ein einziges Ding tun —
// einen Lead für Lusides anlegen. Die eigentliche Absicherung liegt auf
// der RIMA-Seite: nur wer LUSIDE_SYNC_SECRET kennt (serverseitig, nie im
// Browser) darf dort source_company='lusides' setzen. Ohne dieses Secret
// würde RIMA den Aufruf zwar noch annehmen, aber als generisches
// 'rima-equity' statt 'lusides' verbuchen — kein Datenzugriff, nur eine
// falsche Zuordnung, und genau das verhindert das Secret hier.
// (Die Secret-Variable heißt weiterhin LUSIDE_SYNC_SECRET — reine
// Infra-Benennung, nirgends sichtbar, daher nicht mitrotiert.)

const RIMA_URL = Deno.env.get("RIMA_URL") ?? "https://vkiwbxayraxgrachjaoc.supabase.co";
const RIMA_ANON_KEY = Deno.env.get("RIMA_ANON_KEY") ?? "";
const LUSIDE_SYNC_SECRET = Deno.env.get("LUSIDE_SYNC_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM_INFO") ?? "Lusides <inquiry@lusides.com>";
// Interne Benachrichtigung: MAIL_NOTIFY (kommagetrennt möglich) und immer die Gründer.
const NOTIFY_TO = [...new Set([...(Deno.env.get("MAIL_NOTIFY") ?? "inquiry@lusides.com").split(","), "rd@rimaequity.com", "mk@rimaequity.com"]
  .map((x) => x.trim().toLowerCase()).filter(Boolean))];

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Kontaktformular, Chatbot und Seminar-Anmeldung per E-Mail melden. Buchungen nicht –
// dafür verschickt lusides-invoice bereits eine Kopie mit Bestellschein und Rechnung.
async function notifyTeam(name: string, email: string, phone: string, source: string, message: string) {
  if (!RESEND_API_KEY) { console.error("notify skipped: RESEND_API_KEY fehlt"); return; }
  const rows = [["Name", name], ["E-Mail", email], ["Telefon", phone || "–"], ["Quelle", source]]
    .map(([k, v]) => `<tr><td style="color:#56677F;padding:4px 16px 4px 0">${esc(k)}</td><td style="color:#0A1428;padding:4px 0">${esc(v)}</td></tr>`).join("");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM, to: NOTIFY_TO, reply_to: email,
      subject: `Neue Anfrage (${source}): ${name}`,
      html: `<p style="font:15px/1.6 Arial,sans-serif"><strong>Neue Anfrage über lusides.com</strong></p>
        <table style="border-collapse:collapse;font:14px/1.5 Arial,sans-serif">${rows}</table>
        <p style="font:14px/1.6 Arial,sans-serif;white-space:pre-line;margin-top:14px">${esc(message)}</p>
        <p style="font:12px/1.5 Arial,sans-serif;color:#56677F">Antworten geht direkt an ${esc(email)}. Der Lead ist auch im CRM (RIMA Equity) angelegt.</p>`,
    }),
  });
  if (!r.ok) console.error("notify failed", r.status, await r.text());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Spam-Bremse: max. 10 Leads pro IP und Stunde.
  if (!(await allow("lead:" + clientIp(req), 10))) return json({ error: "too many requests" }, 429);

  let body: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    lead_company?: string;
    employee_count?: string;
    annual_revenue?: string;
    biggest_challenge?: string;
    postal_code?: string;
    channel?: string;
    locale?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Alle Felder hart begrenzen, bevor sie ins CRM gehen.
  const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  body = {
    ...body,
    first_name: cut(body.first_name, 80), last_name: cut(body.last_name, 80), email: cut(body.email, 254),
    phone: cut(body.phone, 40), lead_company: cut(body.lead_company, 160), employee_count: cut(body.employee_count, 40),
    annual_revenue: cut(body.annual_revenue, 40), biggest_challenge: cut(body.biggest_challenge, 4000),
    postal_code: cut(body.postal_code, 20), channel: cut(body.channel, 100), locale: cut(body.locale, 5),
  };
  const first_name = body.first_name?.trim() ?? "";
  const last_name = body.last_name?.trim() ?? "";
  const name = [first_name, last_name].filter(Boolean).join(" ").trim() || null;
  const email = body.email?.trim() ?? "";

  if (!name || !isValidEmail(email)) {
    return json({ error: "name und eine gültige E-Mail sind erforderlich" }, 400);
  }

  const extras = [
    body.phone?.trim() ? `Telefon: ${body.phone.trim()}` : null,
    body.postal_code?.trim() ? `PLZ: ${body.postal_code.trim()}` : null,
    body.lead_company?.trim() ? `Unternehmen: ${body.lead_company.trim()}` : null,
    body.employee_count?.trim() ? `Mitarbeiterzahl: ${body.employee_count.trim()}` : null,
    body.annual_revenue?.trim() ? `Jahresumsatz: ${body.annual_revenue.trim()}` : null,
  ].filter(Boolean);
  const message = [body.biggest_challenge?.trim() || "", ...extras].filter(Boolean).join("\n\n") || "(keine Angabe)";

  const challenge = body.biggest_challenge?.trim() || "";
  if (!/^Erstgespräch gebucht/.test(challenge)) {
    const source = body.channel?.trim()
      || (/^Chat/.test(challenge) ? "Chatbot" : /seminar/i.test(challenge) ? "Seminar" : "Kontaktformular");
    try { await notifyTeam(name, email, body.phone?.trim() ?? "", source, message); } catch (e) { console.error("notify error", e); }
  }

  if (!RIMA_ANON_KEY || !LUSIDE_SYNC_SECRET) {
    console.error("lusides-rima-sync misconfigured: missing RIMA_ANON_KEY or LUSIDE_SYNC_SECRET");
    return json({ error: "Konfiguration fehlt" }, 500);
  }

  try {
    const res = await fetch(`${RIMA_URL}/functions/v1/submit-contact`, {
      method: "POST",
      headers: {
        apikey: RIMA_ANON_KEY,
        Authorization: `Bearer ${RIMA_ANON_KEY}`,
        "x-sync-secret": LUSIDE_SYNC_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        channel: body.channel?.trim().slice(0, 100) || "Kontaktformular",
        message,
        locale: body.locale === "en" ? "en" : "de",
        source_company: "lusides",
        source_path: "luside.com",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("RIMA sync failed:", res.status, errText);
      return json({ error: "CRM-Weiterleitung fehlgeschlagen" }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("lusides-rima-sync error:", err);
    return json({ error: "CRM-Weiterleitung fehlgeschlagen" }, 502);
  }
});
