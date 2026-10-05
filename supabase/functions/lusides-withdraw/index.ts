import { createClient } from "npm:@supabase/supabase-js@2";
import { handlePreflight, json } from "../_shared/cors.ts";
import { allow, clientIp } from "../_shared/ratelimit.ts";

// Online-Widerruf „Vertrag widerrufen" (§ 13a FAGG): nimmt die Widerrufserklärung entgegen,
// speichert sie (public.withdrawals) und bestätigt den Eingang samt Datum/Uhrzeit per E-Mail
// an den Kunden; interne Kopie an MAIL_NOTIFY.
//
//   { name, email, order_no?, message?, lang: 'de'|'en' }  → { ok, received_at, mail }
//
// Secrets: RESEND_API_KEY, optional MAIL_FROM_INFO, MAIL_NOTIFY.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM_INFO") ?? "Lusides <inquiry@lusides.com>";
const MAIL_NOTIFY = Deno.env.get("MAIL_NOTIFY") ?? "inquiry@lusides.com";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
type Row = Record<string, any>;

const h = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

function stamp(d: Date, en: boolean) {
  return new Intl.DateTimeFormat(en ? "en-GB" : "de-AT", {
    timeZone: "Europe/Vienna", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d) + (en ? " (Vienna time)" : " (Wiener Zeit)");
}

async function send(body: Row) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b: Row; try { b = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const en = b.lang === "en";
  const name = clean(b.name, 120);
  const email = clean(b.email, 254).toLowerCase();
  const orderNo = clean(b.order_no, 40).toUpperCase() || null;
  const message = clean(b.message, 2000) || null;
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "invalid_input" }, 400);

  const ip = clientIp(req);
  if (!(await allow(`withdraw:ip:${ip}`, 10)) || !(await allow(`withdraw:mail:${email}`, 5, "1 day"))) {
    return json({ error: "rate_limited" }, 429);
  }

  try {
    // Zuordnung zur Buchung (optional): Bestellnummer + E-Mail, sonst jüngste Buchung zur E-Mail
    let appt: Row | null = null;
    if (orderNo) {
      const { data } = await admin.from("appointments").select("id, order_no, start_at").eq("order_no", orderNo).eq("email", email).maybeSingle();
      appt = data;
    }
    if (!appt) {
      const { data } = await admin.from("appointments").select("id, order_no, start_at").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      appt = data;
    }

    const { data: row, error } = await admin.from("withdrawals").insert({
      name, email, order_no: orderNo ?? appt?.order_no ?? null, message, lang: en ? "en" : "de", appointment_id: appt?.id ?? null,
    }).select("id, created_at").single();
    if (error || !row) throw error ?? new Error("insert failed");

    const received = new Date(row.created_at);
    const ref = orderNo ?? appt?.order_no ?? (en ? "not specified" : "nicht angegeben");
    let mail = "sent";
    try {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
      await send({
        from: MAIL_FROM, to: [email], reply_to: MAIL_NOTIFY,
        subject: en ? "Confirmation of receipt: your withdrawal – Lusides" : "Eingangsbestätigung Ihres Widerrufs – Lusides",
        html: en
          ? `<p>Hello ${h(name)},</p><p>we hereby confirm that we received your withdrawal from the contract on <strong>${h(stamp(received, true))}</strong>.</p>
             <p>Order no.: ${h(ref)}${message ? `<br>Your message: ${h(message)}` : ""}</p>
             <p>We will process the withdrawal without undue delay and refund any payments already made within 14 days. If the service has already been partially performed at your request, a proportionate amount may be deducted (see lusides.com/widerruf.html).</p>
             <p>Kind regards<br>Lusides · Legatech GmbH &amp; Co KG</p>`
          : `<p>Guten Tag ${h(name)},</p><p>hiermit bestätigen wir den Eingang Ihres Widerrufs am <strong>${h(stamp(received, false))}</strong>.</p>
             <p>Bestellnummer: ${h(ref)}${message ? `<br>Ihre Nachricht: ${h(message)}` : ""}</p>
             <p>Wir bearbeiten den Widerruf unverzüglich und erstatten bereits geleistete Zahlungen binnen 14 Tagen. Wurde die Leistung auf Ihr Verlangen bereits teilweise erbracht, kann ein anteiliger Betrag einbehalten werden (siehe lusides.com/widerruf.html).</p>
             <p>Beste Grüße<br>Lusides · Legatech GmbH &amp; Co KG</p>`,
      });
    } catch (e) { mail = "failed"; console.error("withdraw mail failed", e); }
    await admin.from("withdrawals").update({ mail_status: mail === "sent" ? "gesendet" : "fehler" }).eq("id", row.id);

    try {
      if (RESEND_API_KEY) await send({
        from: MAIL_FROM, to: [MAIL_NOTIFY], reply_to: email,
        subject: `WIDERRUF eingegangen: ${name} (${ref})`,
        html: `<p><strong>${h(name)}</strong> (${h(email)}) hat am ${h(stamp(received, false))} den Vertrag widerrufen.</p>
               <p>Bestellnummer: ${h(ref)}${appt?.start_at ? `<br>Termin: ${h(new Date(appt.start_at).toLocaleString("de-AT", { timeZone: "Europe/Vienna" }))}` : ""}${message ? `<br>Nachricht: ${h(message)}` : ""}</p>
               <p>Bitte Termin absagen und ggf. Stornorechnung im Admin erstellen. Eingangsbestätigung an den Kunden: ${mail === "sent" ? "versendet" : "FEHLGESCHLAGEN – bitte manuell bestätigen"}.</p>`,
      });
    } catch (e) { console.error("withdraw notify failed", e); }

    return json({ ok: true, received_at: row.created_at, mail });
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
