# Lusides Website

Static site for Lusides, served via GitHub Pages.

## Branches

- `main` — clean, live version. This is what GitHub Pages publishes.
- `staging` — work-in-progress drafts and edits. Merge into `main` once approved.

## Structure

- `site.css` + `site.js` — gemeinsames Designsystem (Farben, Schriften Instrument Sans/Serif + JetBrains Mono, dunkler Header, großer Footer) und Effekte (Smooth Scroll via Lenis, Reveal beim Scrollen, Wort-für-Wort-Highlight, magnetische Buttons, Lichtkegel auf Kacheln, Ablauf-Fortschrittslinie). Wird von jeder Seite nach dem seiteneigenen CSS geladen.

- `index.html` — homepage (hero, problem, model, services, why us, process, FAQ, contact form).
- `team.html`, `datenschutz.html`, `impressum.html`, `admin.html` — subpages.
- `termin.html` + `termin-booking.js` — Terminbuchung: 1 Std. Erstgespräch per Microsoft Teams (350 €). Freie Slots Mo–Fr 09–17 Uhr (Wiener Zeit), gebucht über die Supabase-Funktion `book_appointment`.
- `leistungen-onlineshop-entwicklung.html` — Unterseite von Digitalisierung & KI: Onlineshop-, Web- und Web-App-Entwicklung.
- `admin.html` + `admin-calendar.js` — Admin-Bereich; oben der Terminkalender (Woche/Monat/Jahr). Klick auf einen Namen öffnet die Details mit Status, Bezahlt-Haken, Teams-Link, „Teams-Meeting erstellen“ und „Einladung per E-Mail“.
- `supabase/migrations/20261002120000_appointments.sql` — Tabelle `appointments` + Buchungsfunktionen. Einmalig im Supabase SQL Editor ausführen.
- `seminar.html` — standalone paid-traffic landing page (Meta ads) for the in-person seminar; own form(s), no exit navigation.
- `i18n.js` — DE/EN translations, applied via `data-i18n` attributes.
- `chatbot.js` — bottom-right chat widget (FAQ keyword matching + OpenAI fallback + guided lead capture).
- `supabase/functions/lusides-chat` — Edge Function proxying chat requests to OpenAI (holds the API key server-side).
- `supabase/functions/lusides-rima-sync` — Edge Function forwarding every lead (contact form, seminar form, chatbot) into RIMA Equity's shared CRM.

## Deploying

GitHub Pages is configured to publish from `main`. Once a custom domain is purchased,
add a `CNAME` file at the repo root with the domain name and configure DNS accordingly.
