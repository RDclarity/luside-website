import { createClient } from "npm:@supabase/supabase-js@2";
import { handlePreflight, json } from "../_shared/cors.ts";

// Verschickt nach einer Terminbuchung (termin.html) zwei E-Mails über Resend:
//   1. Bestätigung an den Kunden (mit Kalendereintrag .ics und, falls
//      gesetzt, dem Videocall-Link)
//   2. Benachrichtigung an Lusides (ADMIN_NOTIFY_EMAIL)
//
// Der Browser schickt nur die Termin-ID. Die Daten liest die Funktion selbst
// mit dem Service-Role-Key aus public.appointments — so kann niemand über
// diesen Endpunkt beliebige Mails verschicken. Jede Buchung wird höchstens
// einmal benachrichtigt (notified_at), und nur kurz nach dem Anlegen.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY      Pflicht — API-Key von resend.com
//   MAIL_FROM           Pflicht — z. B. "Lusides <termine@lusides.com>" (Domain in Resend verifiziert)
//   ADMIN_NOTIFY_EMAIL  Pflicht — wohin Lusides über neue Termine informiert wird
//   VIDEO_CALL_URL      Optional — fester Meeting-Link (Teams/Zoom/Meet); ohne ihn
//                       steht in der Mail, dass der Link separat kommt
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const VIDEO_CALL_URL = Deno.env.get("VIDEO_CALL_URL") ?? "";

const TZ = "Europe/Vienna";
const DURATION_MIN = 15;
const NOTIFY_WINDOW_MS = 15 * 60 * 1000;

type Appointment = {
  id: string;
  slot_start: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  offer: string;
  message: string;
  status: string;
  notified_at: string | null;
  created_at: string;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtSlot(start: Date): string {
  const end = new Date(start.getTime() + DURATION_MIN * 60000);
  const day = start.toLocaleDateString("de-AT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("de-AT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day}, ${t(start)}–${t(end)} Uhr`;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function buildIcs(a: Appointment, start: Date): string {
  const end = new Date(start.getTime() + DURATION_MIN * 60000);
  const description = VIDEO_CALL_URL
    ? `Kostenloses Erstgespräch mit Lusides per Videocall.\nLink: ${VIDEO_CALL_URL}`
    : "Kostenloses Erstgespräch mit Lusides per Videocall. Den Link erhältst du vorab per E-Mail.";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lusides//Terminbuchung//DE",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@lusides.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    "SUMMARY:Lusides — kostenloses 15-Minuten-Gespräch",
    `DESCRIPTION:${icsEscape(description)}`,
    ...(VIDEO_CALL_URL ? [`LOCATION:${icsEscape(VIDEO_CALL_URL)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function sendMail(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, ...payload }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !MAIL_FROM || !ADMIN_NOTIFY_EMAIL) {
    console.error("lusides-appointment-notify misconfigured: missing RESEND_API_KEY, MAIL_FROM or ADMIN_NOTIFY_EMAIL");
    return json({ error: "Konfiguration fehlt" }, 500);
  }

  let id = "";
  try {
    id = String((await req.json()).id ?? "");
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Atomar "reservieren", damit doppelte Aufrufe keine doppelten Mails erzeugen.
  const { data, error } = await db
    .from("appointments")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .is("notified_at", null)
    .gte("created_at", new Date(Date.now() - NOTIFY_WINDOW_MS).toISOString())
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return json({ error: "db error" }, 500);
  }
  if (!data) return json({ ok: true, skipped: true });

  const a = data as Appointment;
  const start = new Date(a.slot_start);
  const when = fmtSlot(start);
  const fullName = `${a.first_name} ${a.last_name}`;
  const linkLine = VIDEO_CALL_URL
    ? `<p>Link zum Videocall: <a href="${escapeHtml(VIDEO_CALL_URL)}">${escapeHtml(VIDEO_CALL_URL)}</a></p>`
    : `<p>Den Link zum Videocall erhältst du rechtzeitig vor dem Termin per E-Mail.</p>`;

  try {
    await sendMail({
      to: [a.email],
      reply_to: ADMIN_NOTIFY_EMAIL,
      subject: `Dein Termin bei Lusides: ${when}`,
      html: `<p>Hallo ${escapeHtml(a.first_name)},</p>
<p>danke für deine Buchung! Dein kostenloses 15-Minuten-Gespräch per Videocall ist eingetragen:</p>
<p><strong>${escapeHtml(when)}</strong> (Wiener Zeit)</p>
${linkLine}
<p>Thema: ${escapeHtml(a.offer)}</p>
<p>Falls du den Termin nicht wahrnehmen kannst, antworte einfach auf diese E-Mail.</p>
<p>Bis bald<br>Lusides</p>`,
      attachments: [{ filename: "lusides-termin.ics", content: btoa(unescape(encodeURIComponent(buildIcs(a, start)))) }],
    });

    await sendMail({
      to: [ADMIN_NOTIFY_EMAIL],
      reply_to: a.email,
      subject: `Neuer Termin: ${fullName} — ${when}`,
      html: `<p><strong>${escapeHtml(when)}</strong></p>
<table cellpadding="4">
<tr><td>Name</td><td>${escapeHtml(fullName)}</td></tr>
<tr><td>Telefon</td><td>${escapeHtml(a.phone)}</td></tr>
<tr><td>E-Mail</td><td>${escapeHtml(a.email)}</td></tr>
<tr><td>Angebot</td><td>${escapeHtml(a.offer)}</td></tr>
<tr><td valign="top">Anliegen</td><td>${escapeHtml(a.message).replace(/\n/g, "<br>")}</td></tr>
</table>
<p>Alle Termine: Admin-Bereich → Termine</p>`,
    });
  } catch (err) {
    console.error(err);
    // Reservierung zurücknehmen, damit ein erneuter Aufruf es nochmal versuchen kann.
    await db.from("appointments").update({ notified_at: null }).eq("id", id);
    return json({ error: "mail failed" }, 502);
  }

  return json({ ok: true });
});
