import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";

// Projektdatenblatt als PDF erzeugen und per E-Mail (Resend) versenden:
// an den Kunden (Kopie seiner Angaben) und intern an inquiry@.
//
//   { action: "send", id, token }  – von projektbogen.html direkt nach dem Absenden (genau einmal)
//   { action: "pdf",  id }         – Admin (Bearer = Login-JWT, Benutzer in admin_users)
//
// Secrets: RESEND_API_KEY, optional MAIL_FROM_INFO (Standard "Lusides <inquiry@lusides.com>"),
// optional MAIL_NOTIFY (Standard inquiry@lusides.com).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM_INFO") ?? "Lusides <inquiry@lusides.com>";
const MAIL_NOTIFY = Deno.env.get("MAIL_NOTIFY") ?? "inquiry@lusides.com";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
type Row = Record<string, any>;

const h = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, 120);
const safe = (s: unknown) => String(s ?? "").replace(/[–—]/g, "-").replace(/[„“”]/g, '"').replace(/[‚‘’]/g, "'").replace(/[^\x00-\xFF€]/g, "?");

function labels(lang: string) {
  const en = lang === "en";
  return {
    title: en ? "PROJECT DATA SHEET" : "PROJEKTDATENBLATT",
    ref: en ? "Reference" : "Referenz",
    date: en ? "Date" : "Datum",
    contact: en ? "Contact" : "Ansprechpartner",
    company: en ? "Company" : "Unternehmen",
    figures: en ? "Key figures" : "Kennzahlen",
    situation: en ? "Situation & goals" : "Ausgangslage & Ziele",
    rows: {
      name: "Name", position: en ? "Position" : "Position", email: "E-Mail", phone: en ? "Phone" : "Telefon",
      company: en ? "Company name" : "Firmenname", legal_form: en ? "Legal form" : "Rechtsform", industry: en ? "Industry" : "Branche",
      website: "Website", founded_year: en ? "Founded" : "Gründungsjahr", city: en ? "Location" : "Standort", country: en ? "Country" : "Land",
      business_model: en ? "Business model" : "Geschäftsmodell", succession: en ? "Succession / handover" : "Generationenwechsel / Nachfolge",
      employee_count: en ? "Employees" : "Mitarbeiter", annual_revenue: en ? "Annual revenue" : "Jahresumsatz",
      revenue_trend: en ? "Revenue trend" : "Umsatzentwicklung", locations: en ? "Locations" : "Standorte",
      areas: en ? "Focus areas" : "Bereiche", situation: en ? "Current situation" : "Aktuelle Situation", tried: en ? "Already tried" : "Bereits versucht",
      goal: en ? "Goal in 12 months" : "Ziel in 12 Monaten", urgency: en ? "Timeframe" : "Zeitrahmen", budget: "Budget",
      decision_maker: en ? "Decision maker" : "Entscheider",
    } as Record<string, string>,
    yes: en ? "Yes" : "Ja", no: en ? "No" : "Nein",
    footer: en ? "Confidential – prepared for the initial consultation with Lusides." : "Vertraulich – zur Vorbereitung des Erstgesprächs mit Lusides.",
  };
}

function sections(d: Row, L: ReturnType<typeof labels>): [string, [string, string][]][] {
  const v = (k: string) => {
    const x = d[k];
    if (x === null || x === undefined || x === "" || (Array.isArray(x) && !x.length)) return "";
    if (typeof x === "boolean") return x ? L.yes : L.no;
    return Array.isArray(x) ? x.join(", ") : String(x);
  };
  const pick = (keys: string[]) => keys.map((k) => [L.rows[k], v(k)] as [string, string]).filter(([, val]) => val);
  return [
    [L.contact, pick(["name", "position", "email", "phone"])],
    [L.company, pick(["company", "legal_form", "industry", "website", "founded_year", "city", "country", "business_model", "succession"])],
    [L.figures, pick(["employee_count", "annual_revenue", "revenue_trend", "locations"])],
    [L.situation, pick(["areas", "situation", "tried", "goal", "urgency", "budget", "decision_maker"])],
  ];
}

async function buildPdf(d: Row): Promise<Uint8Array> {
  const L = labels(d.lang);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.08, 0.16), slate = rgb(0.34, 0.4, 0.5), blue = rgb(0.18, 0.42, 1);
  const W = 595.28, H = 841.89, M = 56, LABEL_W = 150;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - 64;
  const text = (s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const wrap = (s: string, f: PDFFont, size: number, maxW: number) => {
    const out: string[] = [];
    for (const para of safe(s).split(/\n/)) {
      let line = "";
      for (const w of para.split(" ")) {
        const t = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (need: number) => { if (y - need < 70) { page = doc.addPage([W, H]); y = H - 64; } };

  page.drawCircle({ x: M + 14, y: y + 6, size: 14, color: rgb(0.07, 0.07, 0.08), borderColor: rgb(0.95, 0.94, 0.93), borderWidth: 2 });
  text("L", M + 9.5, y + 0.5, 15, bold, rgb(0.95, 0.94, 0.93));
  text("Lusides", M + 36, y, 20, bold);
  const dateStr = new Intl.DateTimeFormat(d.lang === "en" ? "en-GB" : "de-AT", { timeZone: "Europe/Vienna", dateStyle: "medium" }).format(new Date(d.created_at));
  const meta = `${L.ref} ${d.ref ?? "-"} · ${L.date} ${dateStr}`;
  page.drawText(safe(meta), { x: W - M - font.widthOfTextAtSize(safe(meta), 9), y: y + 2, size: 9, font, color: slate });
  y -= 52;
  text(L.title, M, y, 22, bold);
  page.drawRectangle({ x: M, y: y - 10, width: 36, height: 2.5, color: blue });
  text(String(d.company ?? ""), M, y - 30, 12, font, slate);
  y -= 64;

  for (const [title, rows] of sections(d, L)) {
    if (!rows.length) continue;
    ensure(40);
    text(title.toUpperCase(), M, y, 9, bold, blue);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.86, 0.9, 0.94) });
    y -= 16;
    for (const [k, val] of rows) {
      const lines = wrap(val, font, 10, W - 2 * M - LABEL_W);
      ensure(lines.length * 13 + 6);
      text(k, M, y, 9.5, font, slate);
      lines.forEach((l, i) => text(l, M + LABEL_W, y - i * 13, 10));
      y -= lines.length * 13 + 7;
    }
    y -= 10;
  }
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: M, y: 58 }, end: { x: W - M, y: 58 }, thickness: 0.6, color: rgb(0.86, 0.9, 0.94) });
    p.drawText(safe(`${L.footer}  Legatech GmbH & Co KG · Endresstraße 50/V3, 1230 Wien · FN 614735 y`), { x: M, y: 44, size: 7.5, font, color: slate });
  }
  return await doc.save();
}

function b64(bytes: Uint8Array) {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function htmlSummary(d: Row) {
  const L = labels(d.lang);
  return sections(d, L).filter(([, r]) => r.length).map(([t, rows]) =>
    `<h3 style="font:600 12px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#2F6BFF;margin:22px 0 6px">${h(t)}</h3>
     <table style="border-collapse:collapse;width:100%;font:14px/1.5 Arial,sans-serif">${rows.map(([k, v]) =>
       `<tr><td style="color:#56677F;padding:4px 16px 4px 0;vertical-align:top;width:170px">${h(k)}</td><td style="color:#0A1428;padding:4px 0">${h(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`
  ).join("");
}

async function sendMails(d: Row) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
  const en = d.lang === "en";
  const pdf = await buildPdf(d);
  const attachments = [{ filename: `${en ? "Project-data-sheet" : "Projektdatenblatt"}-${d.ref}.pdf`, content: b64(pdf) }];
  const send = (body: Row) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => { if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`); });

  const intro = en
    ? `<p style="font:15px/1.6 Arial,sans-serif">Hello ${h(d.name)},</p><p style="font:15px/1.6 Arial,sans-serif">thank you for your project data sheet (${h(d.ref)}). Attached you will find a copy as PDF. We will get back to you within two working days.</p>
       <p style="font:15px/1.6 Arial,sans-serif">Prefer to talk right away? <a href="https://rdclarity.github.io/luside-website/termin.html">Book your initial consultation</a>.</p>`
    : `<p style="font:15px/1.6 Arial,sans-serif">Guten Tag ${h(d.name)},</p><p style="font:15px/1.6 Arial,sans-serif">vielen Dank für Ihr Projektdatenblatt (${h(d.ref)}). Im Anhang finden Sie eine Kopie als PDF. Wir melden uns innerhalb von zwei Werktagen.</p>
       <p style="font:15px/1.6 Arial,sans-serif">Lieber gleich sprechen? <a href="https://rdclarity.github.io/luside-website/termin.html">Erstgespräch direkt buchen</a>.</p>`;
  const outro = `<p style="font:15px/1.6 Arial,sans-serif;margin-top:24px">${en ? "Kind regards" : "Beste Grüße"}<br>Marko Katalan &amp; Richard Dobrohruschka<br>Lusides</p>`;

  await send({
    from: MAIL_FROM, to: [d.email], reply_to: MAIL_NOTIFY,
    subject: en ? `Your project data sheet ${d.ref} – Lusides` : `Ihr Projektdatenblatt ${d.ref} – Lusides`,
    html: intro + htmlSummary(d) + outro, attachments,
  });
  try {
    await send({
      from: MAIL_FROM, to: [MAIL_NOTIFY], reply_to: d.email,
      subject: `Neues Projektdatenblatt ${d.ref}: ${oneLine(d.company)} (${oneLine(d.employee_count)} MA, ${oneLine(d.annual_revenue)})`,
      html: `<p style="font:15px/1.6 Arial,sans-serif"><strong>${h(d.name)}</strong> (${h(d.company)}) hat ein Projektdatenblatt ausgefüllt.</p>` + htmlSummary({ ...d, lang: "de" }),
      attachments,
    });
  } catch (e) { console.error("notify failed", e); }
}

async function requireAdmin(req: Request) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
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
      if (typeof body.id !== "string" || typeof body.token !== "string") return json({ error: "not found" }, 404);
      // Atomar beanspruchen: nur ein Versand pro Datenblatt
      const { data: claim } = await admin.from("project_sheets").update({ mail_status: "gesendet" })
        .eq("id", body.id).eq("token", body.token).eq("mail_status", "offen").select("*");
      if (!claim?.length) return json({ ok: true, already: true });
      try {
        await sendMails(claim[0]);
        return json({ ok: true });
      } catch (e) {
        await admin.from("project_sheets").update({ mail_status: "fehler", mail_error: String(e).slice(0, 500) }).eq("id", body.id);
        console.error(e); return json({ error: "mail failed" }, 502);
      }
    }
    if (!(await requireAdmin(req))) return json({ error: "unauthorized" }, 401);
    if (body.action === "pdf") {
      const { data: d } = await admin.from("project_sheets").select("*").eq("id", body.id).single();
      if (!d) return json({ error: "not found" }, 404);
      return new Response(await buildPdf(d), { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
    }
    if (body.action === "resend") {
      const { data: d } = await admin.from("project_sheets").select("*").eq("id", body.id).single();
      if (!d) return json({ error: "not found" }, 404);
      await sendMails(d);
      await admin.from("project_sheets").update({ mail_status: "gesendet", mail_error: null }).eq("id", d.id);
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
