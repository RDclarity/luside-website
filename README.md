# Luside Website

Static site for Luside, served via GitHub Pages.

## Branches

- `main` — clean, live version. This is what GitHub Pages publishes.
- `staging` — work-in-progress drafts and edits. Merge into `main` once approved.

## Structure

- `index.html` — homepage (hero, problem, model, services, why us, process, FAQ, contact form).
- `team.html`, `datenschutz.html`, `impressum.html`, `admin.html` — subpages.
- `i18n.js` — DE/EN translations, applied via `data-i18n` attributes.
- `chatbot.js` — bottom-right chat widget (FAQ keyword matching + OpenAI fallback + guided lead capture).
- `supabase/functions/claritylab-chat` — Edge Function proxying chat requests to OpenAI (holds the API key server-side).

## Deploying

GitHub Pages is configured to publish from `main`. Once a custom domain is purchased,
add a `CNAME` file at the repo root with the domain name and configure DNS accordingly.
