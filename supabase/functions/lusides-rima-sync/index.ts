import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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
