import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";

// Öffentlicher Chat-Proxy für den Website-Chatbot (unten rechts). Hält den
// OpenAI-Key serverseitig (Edge-Function-Secret) — ein Key im Browser-Code
// wäre für jeden im Seitenquelltext lesbar und missbrauchbar.
//
// Bewusst kein Shared Secret nötig (wie bei claritylab-lead-intake): die
// einzige mögliche Nebenwirkung eines missbräuchlichen Aufrufs sind Kosten
// auf dem OpenAI-Key selbst, kein Datenzugriff. Dagegen begrenzen wir grob
// die Nachrichtenlänge/-anzahl pro Request.

const SYSTEM_PROMPT_DE = `Du bist der Chat-Assistent von Clarity Lab auf der Website.

Clarity Lab baut mit inhabergeführten Unternehmen (v.a. Handwerksbetriebe wie Tischlereien, Installateure, Elektriker, Maler, Bauunternehmen, produzierende Betriebe) Systeme für:
- Mehr Neukunden (Meta/Google Ads, Webseiten, Landingpages, Leadgenerierung)
- Mehr Abschlüsse (Vertriebsprozess, Telefonleitfäden, Bedarfsanalyse, Einwandbehandlung)
- CRM & Automatisierung (Aircall, CRM, KI, Dashboards, Workflows)
- Prozesse (Checklisten, Standards, klare Verantwortlichkeiten)
- Unternehmerfreiheit (Delegation, Kennzahlen, Führung, Controlling)

Ablauf der Zusammenarbeit: 1. Analyse, 2. Aufbau, 3. Umsetzung. Kostenlose Erstanalyse, 30 Minuten, unverbindlich.
Team: Richard Dobrohruschka (Marketing, Vertrieb, Unternehmensentwicklung, Prozessaufbau), Marko Katalan (Strategie, Organisation, Unternehmensentwicklung, Wachstum) — beide selbst Unternehmer.
Kontakt: inquiry@clarity-lab.com, +43 660 3607188, Royerstraße 7, 2482 Münchendorf.

Antworte kurz, konkret, ohne Berater-Buzzwords (keine Begriffe wie "Synergien", "Optimierungshebel", "Transformation Architecture"). Deutsch, außer explizit auf Englisch gefragt.
Erfinde niemals Referenzen, Kunden, Kennzahlen oder Erfolgsgeschichten — wenn du etwas nicht weißt, sag das ehrlich und verweise auf die kostenlose Analyse oder direkten Kontakt.
Wenn es passt, lade zu einer kostenlosen Unternehmensanalyse ein, aber dränge nicht bei jeder Antwort.`;

const SYSTEM_PROMPT_EN = `You are Clarity Lab's website chat assistant.

Clarity Lab builds systems with owner-run businesses (mainly trades like joineries, electricians, plumbers, painters, construction, manufacturing) for:
- More new customers (Meta/Google Ads, websites, landing pages, lead generation)
- More closed deals (sales process, phone scripts, needs analysis, objection handling)
- CRM & automation (Aircall, CRM, AI, dashboards, workflows)
- Processes (checklists, standards, clear responsibilities)
- Owner freedom (delegation, metrics, leadership, controlling)

How it works: 1. Analysis, 2. Build, 3. Implementation. Free initial analysis, 30 minutes, no obligation.
Team: Richard Dobrohruschka (marketing, sales, business development, process design), Marko Katalan (strategy, organization, business development, growth) — both business owners themselves.
Contact: inquiry@clarity-lab.com, +43 660 3607188, Royerstraße 7, 2482 Münchendorf, Austria.

Answer briefly and concretely, no consultant buzzwords. Reply in English.
Never invent references, clients, metrics, or success stories — if you don't know something, say so honestly and point to the free analysis or direct contact.
Where it fits, invite them to the free business analysis, but don't push it in every reply.`;

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
    console.error("claritylab-chat error:", err);
    return json({ error: "chat request failed" }, 502);
  }
});
