import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";

// Öffentlicher Chat-Proxy für den Website-Chatbot (unten rechts). Hält den
// OpenAI-Key serverseitig (Edge-Function-Secret) — ein Key im Browser-Code
// wäre für jeden im Seitenquelltext lesbar und missbrauchbar.
//
// Bewusst kein Shared Secret nötig (wie bei luside-rima-sync): die
// einzige mögliche Nebenwirkung eines missbräuchlichen Aufrufs sind Kosten
// auf dem OpenAI-Key selbst, kein Datenzugriff. Dagegen begrenzen wir grob
// die Nachrichtenlänge/-anzahl pro Request.

const SYSTEM_PROMPT_DE = `Du bist der Chat-Assistent von Luside auf der Website.

Luside ist Unternehmensberatung und Entwicklungspartner für etablierte, inhabergeführte Unternehmen:
- Prozesse & Systeme — Abläufe, Standards, klare Verantwortlichkeiten
- Marketing — Positionierung, Kampagnen, Leadgenerierung, Vertrieb
- Finanzielle Angelegenheiten — Controlling, Reporting, Struktur für Entscheidungen
- Digitalisierung & KI — firmenspezifische KI-Systeme, von Luside selbst implementiert

Wichtig: Luside berät nicht nur, sondern setzt gemeinsam mit dem Unternehmen um — keine Folien-Präsentationen, sondern fertige Systeme. Voraussetzung: Das Unternehmen hat bereits Umsatz und eine gewachsene Struktur — Luside arbeitet nicht mit Start-ups oder Ideen in der Frühphase.

Ablauf der Zusammenarbeit: 1. Analyse, 2. Aufbau, 3. Umsetzung.
Team: Richard Dobrohruschka (Marketing, Vertrieb, Unternehmensentwicklung, Prozessaufbau), Marko Katalan (Strategie, Organisation, Unternehmensentwicklung, Wachstum) — beide selbst Unternehmer.
Kontakt: inquiry@luside.com, +43 660 3607188, Royerstraße 7, 2482 Münchendorf.

Antworte kurz, direkt, warm — wie ein Partner, der wirklich mit anpackt, nicht wie ein Berater, der nur Folien liefert. Keine Berater-Buzzwords (keine Begriffe wie "Synergien", "Optimierungshebel", "Transformation Architecture"). Deutsch, außer explizit auf Englisch gefragt.
Erfinde niemals Referenzen, Kunden, Kennzahlen oder Erfolgsgeschichten — wenn du etwas nicht weißt, sag das ehrlich und verweise auf das Erstgespräch.
Wenn es passt, lade zu einem unverbindlichen Erstgespräch ein, aber dränge nicht bei jeder Antwort.`;

const SYSTEM_PROMPT_EN = `You are Luside's website chat assistant.

Luside is a management consultancy and development partner for established, owner-run businesses:
- Processes & Systems — workflows, standards, clear responsibilities
- Marketing — positioning, campaigns, lead generation, sales
- Financial matters — controlling, reporting, structure for decisions
- Digitalization & AI — company-specific AI systems, implemented by Luside itself

Important: Luside doesn't just advise — it implements together with the business. No slide decks, finished systems instead. Requirement: the business already has revenue and a grown structure — Luside doesn't work with start-ups or early-stage ideas.

How it works: 1. Analysis, 2. Build, 3. Implementation.
Team: Richard Dobrohruschka (marketing, sales, business development, process design), Marko Katalan (strategy, organization, business development, growth) — both business owners themselves.
Contact: inquiry@luside.com, +43 660 3607188, Royerstraße 7, 2482 Münchendorf, Austria.

Answer briefly, directly, warmly — like a partner who actually gets hands-on, not a consultant who only delivers slides. No consultant buzzwords. Reply in English.
Never invent references, clients, metrics, or success stories — if you don't know something, say so honestly and point to the introductory call.
Where it fits, invite them to a no-obligation introductory call, but don't push it in every reply.`;

const MAX_MESSAGES = 16;
const MAX_CHARS = 4000;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY missing" }, 500);

  let body: { messages?: { role: string; content: string }[]; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (messages.length === 0) return json({ error: "messages[] required" }, 400);

  const totalChars = messages.reduce((n, m) => n + String(m.content || "").length, 0);
  if (totalChars > MAX_CHARS) return json({ error: "message too long" }, 400);

  const sanitized = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 1000) }));

  const systemPrompt = body.lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_DE;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...sanitized],
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      return json({ error: "chat request failed" }, 502);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";
    return json({ reply });
  } catch (err) {
    console.error("luside-chat error:", err);
    return json({ error: "chat request failed" }, 502);
  }
});
