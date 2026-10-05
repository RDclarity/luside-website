import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";

// Erzeugt Bestellschein + Rechnung (PDF) zu einer Terminbuchung und versendet
// beides über Resend von invoice@lusides.com an den Kunden.
//
// Aufrufe (POST, JSON):
//   { action: "send",   appointment_id, token }   – von termin.html direkt nach der Buchung
//                                                   (token = booking_token aus book_appointment)
//   { action: "resend", appointment_id }           – Admin (Bearer = Login-JWT)
//   { action: "pdf",    invoice_id, doc }          – Admin, doc = "invoice" | "order" → PDF-Download
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   – API-Key von resend.com (Domain lusides.com dort verifiziert)
//   MAIL_FROM        – optional, Standard "Lusides <invoice@lusides.com>"
//   MAIL_NOTIFY      – optional, interne Kopie jeder Buchung (Standard inquiry@lusides.com)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY stellt Supabase automatisch bereit.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Lusides <invoice@lusides.com>";
const MAIL_NOTIFY_RAW = Deno.env.get("MAIL_NOTIFY") ?? "inquiry@lusides.com";
// Interne Kopien gehen an MAIL_NOTIFY (kommagetrennt möglich) und immer zusätzlich an die Gründer.
const NOTIFY_TO = [...new Set([...MAIL_NOTIFY_RAW.split(","), "rd@rimaequity.com", "mk@rimaequity.com"].map((x) => x.trim().toLowerCase()).filter(Boolean))];
const MAIL_NOTIFY = NOTIFY_TO[0];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Row = Record<string, any>;

// HTML-Escaping für alles, was aus Kundeneingaben in E-Mails landet.
const h = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, 120);
function countryName(code: string | null | undefined, lang: string) {
  if (!code) return "";
  try { return new Intl.DisplayNames([lang === "en" ? "en" : "de"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function T(lang: string, meeting = "video", customerTz: string | null = null) {
  const en = lang === "en";
  const phone = meeting === "phone";
  return {
    invoice: en ? "INVOICE" : "RECHNUNG",
    storno: en ? "CANCELLATION INVOICE" : "STORNORECHNUNG",
    order: en ? "ORDER CONFIRMATION" : "BESTELLSCHEIN",
    no: en ? "Invoice no." : "Rechnungsnummer",
    orderNo: en ? "Order no." : "Bestellnummer",
    date: en ? "Invoice date" : "Rechnungsdatum",
    orderDate: en ? "Order date" : "Bestelldatum",
    service: en ? "Date of service" : "Leistungsdatum",
    appt: en ? "Appointment" : "Termin",
    due: en ? "Due date" : "Zahlbar bis",
    pos: en ? "Item" : "Pos.",
    desc: en ? "Description" : "Bezeichnung",
    qty: en ? "Qty" : "Menge",
    unit: en ? "Unit price" : "Einzelpreis",
    total: en ? "Amount" : "Betrag",
    net: en ? "Net amount" : "Nettobetrag",
    vat: en ? "VAT" : "USt",
    gross: en ? "Total" : "Gesamtbetrag",
    customer: en ? "Customer" : "Kunde",
    yourUid: en ? "Customer VAT ID" : "UID des Empfängers",
    ourUid: en ? "Our VAT ID" : "Unsere UID",
    pay: en ? "Please transfer the amount, quoting the invoice number, to:" : "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf:",
    payNoBank: en ? "Payment details will follow separately." : "Die Zahlungsdetails erhalten Sie gesondert.",
    thanks: en ? "Thank you for your booking." : "Vielen Dank für Ihre Buchung.",
    notInvoice: en ? "This order confirmation is not an invoice." : "Dieser Bestellschein ist keine Rechnung.",
    consent: en
      ? "You expressly requested that we start the service before the end of the withdrawal period and acknowledged that, as a consumer, you lose your right of withdrawal once the consultation has been fully performed. Terms: lusides.com/agb.html · Withdrawal: lusides.com/widerruf.html"
      : "Sie haben ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist mit der Leistung beginnen, und zur Kenntnis genommen, dass Sie als Verbraucher Ihr Widerrufsrecht bei vollständiger Vertragserfüllung verlieren. AGB: lusides.com/agb.html · Widerruf: lusides.com/widerruf.html",
    terms: en
      ? "Free rescheduling or cancellation up to 24 hours before the appointment. " + (phone
        ? "We will call you at the phone number you provided at the time of the appointment."
        : "We will send you the Microsoft Teams link by email before the appointment.")
      : "Kostenlose Umbuchung oder Stornierung bis 24 Stunden vor dem Termin. " + (phone
        ? "Wir rufen Sie zum Termin unter der angegebenen Telefonnummer an."
        : "Den Microsoft-Teams-Link senden wir Ihnen vor dem Termin per E-Mail."),
    tzNote: en
      ? (customerTz ? `Times in your time zone (${customerTz.replace(/_/g, " ")}); Vienna time in brackets` : "Times in Vienna time (CET/CEST)")
      : "Zeiten in Wiener Zeit (MEZ/MESZ)",
    tbd: en ? "to follow" : "folgt",
  };
}

function money(v: number, cur: string, lang: string) {
  // de-DE: "300,00 €" wie auf der Website (de-AT würde "€ 300,00" schreiben)
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "de-DE", { style: "currency", currency: cur }).format(v);
}
// Gesprächsart → Positionstext (identisch zu book_appointment in 20261007100000_booking_channel.sql)
function meetingDesc(lang: string, meeting: string) {
  if (lang === "en") return meeting === "phone" ? "Initial consultation, 30 minutes, by phone" : "Initial consultation, 30 minutes, via Microsoft Teams (video)";
  return meeting === "phone" ? "Erstgespräch, 30 Minuten, per Telefon" : "Erstgespräch, 30 Minuten, per Microsoft Teams (Video)";
}
function meetingShort(lang: string, meeting: string) {
  if (lang === "en") return meeting === "phone" ? "Phone call (we call you)" : "Video call via Microsoft Teams";
  return meeting === "phone" ? "Telefonat (wir rufen Sie an)" : "Video-Call über Microsoft Teams";
}
// Kundenzeitzone nur für die englische (US-)Seite und nur, wenn sie gültig ist.
function customerTz(a: Row | null | undefined, lang: string): string | null {
  const tz = a?.customer_tz;
  if (lang !== "en" || typeof tz !== "string" || !tz || tz === "Europe/Vienna") return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; }
}

function dateFmt(d: string | Date, lang: string) {
  return lang === "en"
    ? new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vienna", day: "numeric", month: "short", year: "numeric" }).format(new Date(d))
    : new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
function viennaTime(d: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "de-AT", { timeZone: "Europe/Vienna", hour: "numeric", minute: "2-digit" }).format(new Date(d));
}
// Kurzform für den Bestellschein-Kopf. US: Kundenzeitzone mit Zonenname, Wiener Zeit in Klammern.
function shortDateTime(d: string, lang: string, tz: string | null = null) {
  if (lang === "en" && tz) {
    const local = new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(d));
    return `${local} (${viennaTime(d, lang)} Vienna)`;
  }
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  return `${dateFmt(d, lang)}, ${time}`;
}
// Langform für Positionstext und E-Mail. DE: Wiener Zeit. US: Kundenzeitzone + Wiener Zeit in Klammern.
function dateTimeFmt(d: string, lang: string, tz: string | null = null) {
  if (lang === "en") {
    const zone = tz ?? "Europe/Vienna";
    const main = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(d));
    return tz ? `${main} (${viennaTime(d, lang)} Vienna time)` : `${main} (Vienna time)`;
  }
  return new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) + " Uhr";
}

// pdf-lib-Standardschriften können nur WinAnsi – sicherheitshalber alles andere ersetzen.
function safe(s: unknown): string {
  return String(s ?? "").replace(/[\u202F\u2009\u2007]/g, " ").replace(/[\u200E\u200F]/g, "").replace(/[–—]/g, "-").replace(/[„“”]/g, '"').replace(/[‚‘’]/g, "'").replace(/[^\x00-\xFF€]/g, "?");
}

async function buildPdf(kind: "invoice" | "order", s: Row, a: Row, inv: Row): Promise<Uint8Array> {
  const lang = inv?.lang ?? a.lang ?? "de";
  const meeting = a?.meeting_type === "phone" ? "phone" : "video";
  const tz = customerTz(a, lang);
  const t = T(lang, meeting, tz);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.08, 0.16), slate = rgb(0.34, 0.4, 0.5), blue = rgb(0.18, 0.42, 1);
  const W = 595.28, M = 56;
  const text = (p: PDFPage, str: string, x: number, y: number, size = 10, f: PDFFont = font, color = ink) =>
    p.drawText(safe(str), { x, y, size, font: f, color });
  const right = (p: PDFPage, str: string, xr: number, y: number, size = 10, f: PDFFont = font, color = ink) =>
    p.drawText(safe(str), { x: xr - f.widthOfTextAtSize(safe(str), size), y, size, font: f, color });

  // Kopf
  page.drawCircle({ x: M + 14, y: 790, size: 14, color: rgb(0.07, 0.07, 0.08), borderColor: rgb(0.95, 0.94, 0.93), borderWidth: 2 });
  text(page, "L", M + 9.5, 784.5, 15, bold, rgb(0.95, 0.94, 0.93));
  text(page, s.brand, M + 36, 784, 20, bold);
  const sender = [s.legal_name, s.street, `${s.zip} ${s.city}`, s.country, s.email_contact, s.phone];
  sender.forEach((l, i) => right(page, l, W - M, 796 - i * 12, 8.5, font, slate));

  // Empfänger
  const isOrder = kind === "order";
  const cust = isOrder
    ? [a.billing_company, a.billing_name, a.billing_street, [a.billing_zip, a.billing_city].filter(Boolean).join(" "), countryName(a.billing_country, lang)]
    : [inv.customer_company, inv.customer_name, inv.customer_street, [inv.customer_zip, inv.customer_city].filter(Boolean).join(" "), countryName(inv.customer_country, lang)];
  text(page, `${s.legal_name} · ${s.street} · ${s.zip} ${s.city}`, M, 700, 7, font, slate);
  cust.filter(Boolean).forEach((l, i) => text(page, String(l), M, 682 - i * 13, 10.5, i === 0 ? bold : font));

  // Titel + Metadaten
  const title = isOrder ? t.order : (inv.kind === "storno" ? t.storno : t.invoice);
  text(page, title, M, 585, 22, bold);
  page.drawRectangle({ x: M, y: 575, width: 36, height: 2.5, color: blue });
  const meta: [string, string][] = isOrder
    ? [[t.orderNo, a.order_no], [t.orderDate, dateFmt(a.created_at, lang)], [t.appt, shortDateTime(a.start_at, lang, tz)]]
    : [[t.no, inv.invoice_no], [t.date, dateFmt(inv.issue_date, lang)], [t.service, dateFmt(inv.service_date, lang)], [t.orderNo, a?.order_no ?? "-"]];
  if (!isOrder && inv.due_date && inv.kind !== "storno") meta.push([t.due, dateFmt(inv.due_date, lang)]);
  if (!isOrder && inv.customer_uid) meta.push([t.yourUid, inv.customer_uid]);
  meta.forEach(([k, v], i) => { text(page, k, 340, 600 - i * 14, 9, font, slate); right(page, v, W - M, 600 - i * 14, 9, bold); });

  // Positionstabelle
  let y = 500;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.96, 0.97, 0.98) });
  text(page, t.pos, M + 8, y, 9, bold, slate); text(page, t.desc, M + 46, y, 9, bold, slate);
  right(page, t.qty, 370, y, 9, bold, slate); right(page, t.unit, 460, y, 9, bold, slate); right(page, t.total, W - M - 8, y, 9, bold, slate);
  y -= 30;
  const cur = isOrder ? a.currency : inv.currency;
  const qty = isOrder ? 1 : Math.abs(Number(inv.quantity ?? 1));
  const net = isOrder ? Number(inv?.net_amount ?? 0) : Number(inv.net_amount);
  const desc = isOrder ? meetingDesc(lang, meeting) : inv.description;
  // Bezeichnung umbrechen, damit sie nicht in die Spalte "Menge" läuft
  const descMax = 370 - 30 - (M + 46);
  const descLines: string[] = [];
  for (const w of safe(desc).split(" ")) {
    const cand = descLines.length ? descLines[descLines.length - 1] + " " + w : w;
    if (descLines.length && bold.widthOfTextAtSize(cand, 10) > descMax) descLines.push(w);
    else if (descLines.length) descLines[descLines.length - 1] = cand; else descLines.push(w);
  }
  text(page, "1", M + 8, y, 10);
  descLines.forEach((l, i) => text(page, l, M + 46, y - i * 13, 10, bold));
  const extra = (descLines.length - 1) * 13;
  text(page, `${t.appt}: ${a?.start_at ? dateTimeFmt(a.start_at, lang, tz) : dateFmt(inv.service_date, lang)}`, M + 46, y - 14 - extra, 8.5, font, slate);
  right(page, String(qty), 370, y, 10); right(page, money(net / qty, cur, lang), 460, y, 10); right(page, money(net, cur, lang), W - M - 8, y, 10);
  y -= 34 + extra;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.86, 0.9, 0.94) });

  // Summen
  y -= 22;
  const rows: [string, number, boolean][] = [[t.net, net, false]];
  const vatRate = Number(inv?.vat_rate ?? 0), vat = Number(inv?.vat_amount ?? 0), gross = Number(inv?.gross_amount ?? net);
  if (vatRate > 0) rows.push([`${t.vat} ${vatRate.toLocaleString(lang === "en" ? "en-US" : "de-AT")} %`, vat, false]);
  rows.push([t.gross, gross, true]);
  rows.forEach(([k, v, b], i) => {
    text(page, k, 340, y - i * 16, b ? 11 : 10, b ? bold : font, b ? ink : slate);
    right(page, money(v, cur, lang), W - M - 8, y - i * 16, b ? 11 : 10, b ? bold : font);
  });
  y -= rows.length * 16 + 22;

  // Hinweise
  const notes: string[] = [];
  if (inv?.tax_note) notes.push(inv.tax_note);
  if (isOrder) { notes.push(t.notInvoice); notes.push(t.terms); if (a?.early_start_consent_at) notes.push(t.consent); notes.push(t.tzNote); }
  else if (inv.kind !== "storno") {
    if (cur === "USD" && s.us_account && s.us_routing) {
      notes.push(t.pay);
      notes.push(`${s.us_account_name ? s.us_account_name + " · " : ""}Account ${s.us_account} · Routing (ABA) ${s.us_routing}${s.us_bank ? " · " + s.us_bank : ""}`);
    } else if (s.iban) { notes.push(t.pay); notes.push(`IBAN ${String(s.iban).replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ")}${s.bic ? " · BIC " + s.bic : ""}${s.bank ? " · " + s.bank : ""}`); }
    else notes.push(t.payNoBank);
  }
  notes.push(t.thanks);
  const wrap = (str: string, max = 88) => {
    const out: string[] = []; let line = "";
    for (const w of safe(str).split(" ")) { if ((line + " " + w).trim().length > max) { out.push(line); line = w; } else line = (line + " " + w).trim(); }
    if (line) out.push(line); return out;
  };
  notes.flatMap((n) => wrap(n)).forEach((l, i) => text(page, l, M, y - i * 13, 9, font, i === 0 && inv?.tax_note ? ink : slate));

  // Fußzeile (Pflichtangaben)
  page.drawLine({ start: { x: M, y: 72 }, end: { x: W - M, y: 72 }, thickness: 0.6, color: rgb(0.86, 0.9, 0.94) });
  const foot1 = `${s.legal_name} · ${s.street}, ${s.zip} ${s.city} · ${s.fn} · ${s.court}`;
  const foot2 = `${t.ourUid}: ${s.uid ?? t.tbd} · ${s.email_invoice} · ${s.phone}`;
  text(page, foot1, M, 58, 7.5, font, slate); text(page, foot2, M, 47, 7.5, font, slate);
  return await doc.save();
}

function b64(bytes: Uint8Array) {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function load(appointmentId: string) {
  const [{ data: s }, { data: a }, { data: inv }] = await Promise.all([
    admin.from("billing_settings").select("*").eq("id", true).single(),
    admin.from("appointments").select("*").eq("id", appointmentId).single(),
    admin.from("invoices").select("*").eq("appointment_id", appointmentId).eq("kind", "rechnung").neq("status", "storniert").order("created_at").limit(1).maybeSingle(),
  ]);
  return { s, a, inv };
}

async function sendMails(s: Row, a: Row, inv: Row) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
  const lang = a.lang ?? "de";
  const en = lang === "en";
  const [order, invoice] = await Promise.all([buildPdf("order", s, a, inv), buildPdf("invoice", s, a, inv)]);
  const meeting = a.meeting_type === "phone" ? "phone" : "video";
  const tz = customerTz(a, lang);
  const when = dateTimeFmt(a.start_at, lang, tz);
  const whenVienna = dateTimeFmt(a.start_at, "de");
  const amount = money(Number(inv.gross_amount), inv.currency, lang);
  const how = en
    ? (meeting === "phone"
      ? `We will call you at <strong>${h(a.phone)}</strong> at the time of the appointment.`
      : "We will send you the Microsoft Teams link by email before the appointment.")
    : (meeting === "phone"
      ? `Wir rufen Sie zum Termin unter <strong>${h(a.phone)}</strong> an.`
      : "Den Microsoft-Teams-Link senden wir Ihnen vor dem Termin per E-Mail.");
  const subject = en
    ? `Your Lusides booking ${a.order_no} – invoice ${inv.invoice_no}`
    : `Ihre Buchung bei Lusides ${a.order_no} – Rechnung ${inv.invoice_no}`;
  const html = en
    ? `<p>Hello ${h(a.name)},</p><p>thank you for booking your initial consultation with Lusides.</p>
       <p><strong>${h(when)}</strong> · 30 minutes · ${h(meetingShort(lang, meeting))}</p>
       <p>Attached you will find your order confirmation <strong>${h(a.order_no)}</strong> and invoice <strong>${h(inv.invoice_no)}</strong> (${h(amount)}).
       ${how}</p>${a.early_start_consent_at ? `<p style="font-size:13px;color:#56677F">${h(T(lang).consent)}</p>` : ""}<p>Kind regards<br>Marko Katalan &amp; Richard Dobrohruschka<br>Lusides</p>`
    : `<p>Guten Tag ${h(a.name)},</p><p>vielen Dank für Ihre Buchung eines Erstgesprächs bei Lusides.</p>
       <p><strong>${h(when)}</strong> · 30 Minuten · ${h(meetingShort(lang, meeting))}</p>
       <p>Im Anhang finden Sie Ihren Bestellschein <strong>${h(a.order_no)}</strong> und die Rechnung <strong>${h(inv.invoice_no)}</strong> (${h(amount)}).
       ${how}</p>${a.early_start_consent_at ? `<p style="font-size:13px;color:#56677F">${h(T(lang).consent)}</p>` : ""}<p>Beste Grüße<br>Marko Katalan &amp; Richard Dobrohruschka<br>Lusides</p>`;
  const attachments = [
    { filename: `${en ? "Order" : "Bestellschein"}-${a.order_no}.pdf`, content: b64(order) },
    { filename: `${en ? "Invoice" : "Rechnung"}-${inv.invoice_no}.pdf`, content: b64(invoice) },
  ];
  const send = (body: Row) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => { if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`); });

  await send({ from: MAIL_FROM, to: [a.email], reply_to: s.email_contact, subject, html, attachments });
  // Interne Kopie: Fehler hier dürfen die (bereits erfolgte) Kundenmail nicht als gescheitert markieren.
  try {
    await send({
      from: MAIL_FROM, to: NOTIFY_TO,
      subject: `Neue Buchung (${meeting === "phone" ? "TELEFON" : "Teams"}): ${oneLine(a.name)} – ${oneLine(whenVienna)}`,
      html: `<p><strong>${h(a.name)}</strong>${a.company ? " (" + h(a.company) + ")" : ""} hat ein Erstgespräch gebucht.</p>
             <p style="font-size:16px"><strong>${meeting === "phone" ? "Telefon – bitte anrufen: " + h(a.phone ?? "-") : "Video (Microsoft Teams) – Link vor dem Termin senden"}</strong></p>
             <p>${h(whenVienna)} (Wiener Zeit)${tz ? " · Kunde: " + h(when) : ""} · ${h(a.email)}${a.phone ? " · " + h(a.phone) : ""}${a.topic ? "<br>Thema: " + h(a.topic) : ""}<br>${h(a.message ?? "").replace(/\n/g, "<br>")}</p>
             <p>Bestellschein ${h(a.order_no)} · Rechnung ${h(inv.invoice_no)} · ${h(amount)}</p>`,
      attachments,
    });
  } catch (e) { console.error("notify failed", e); }
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await userClient.auth.getUser();
  if (!data?.user || (data.user as Row).is_anonymous) return false;
  const { data: row } = await admin.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!row;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Row; try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  try {
    if (body.action === "send") {
      const { s, a, inv } = await load(body.appointment_id);
      if (!a || !inv || typeof body.token !== "string" || a.booking_token !== body.token) return json({ error: "not found" }, 404);
      // Atomar beanspruchen: nur ein einziger Aufruf darf versenden (kein Mail-Bombing durch Wiederholen).
      const { data: claim } = await admin.from("appointments").update({ mail_status: "gesendet" })
        .eq("id", a.id).eq("booking_token", body.token).eq("mail_status", "offen").select("id");
      if (!claim?.length) return json({ ok: true, already: true });
      try {
        await sendMails(s!, a, inv);
        await admin.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", inv.id);
        return json({ ok: true });
      } catch (e) {
        await admin.from("appointments").update({ mail_status: "fehler", mail_error: String(e).slice(0, 500) }).eq("id", a.id);
        console.error(e); return json({ error: "mail failed" }, 502);
      }
    }

    if (!(await requireAdmin(req))) return json({ error: "unauthorized" }, 401);

    if (body.action === "resend") {
      const { s, a, inv } = await load(body.appointment_id);
      if (!a || !inv) return json({ error: "not found" }, 404);
      await sendMails(s!, a, inv);
      await admin.from("appointments").update({ mail_status: "gesendet", mail_error: null }).eq("id", a.id);
      await admin.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", inv.id);
      return json({ ok: true });
    }

    if (body.action === "pdf") {
      const { data: inv } = await admin.from("invoices").select("*").eq("id", body.invoice_id).single();
      if (!inv) return json({ error: "not found" }, 404);
      const [{ data: s }, { data: a }] = await Promise.all([
        admin.from("billing_settings").select("*").eq("id", true).single(),
        inv.appointment_id ? admin.from("appointments").select("*").eq("id", inv.appointment_id).single() : Promise.resolve({ data: null }),
      ]);
      const pdf = await buildPdf(body.doc === "order" && a ? "order" : "invoice", s!, a ?? {}, inv);
      return new Response(pdf, { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
