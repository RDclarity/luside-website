# Terminbuchung — technische Anforderungen & Einrichtung

**Betreff:** Lusides Terminbuchung — was noch verbunden werden muss

Hallo,

die Terminbuchung für das kostenlose 15-Minuten-Gespräch per Videocall ist gebaut
(Seite `termin.html`, Reiter „Termin buchen“ oben in der Navigation, Liste im
Admin unter lusides.com/admin → „Termine“). Damit alles live funktioniert, müssen
noch folgende Dinge verbunden werden:

---

## 1. Datenbank (Supabase) — Pflicht

Projekt: `knuktzuqqmrrkpkusren` (dasselbe wie für Kontaktformular & Admin).

1. Supabase → **SQL Editor** öffnen.
2. Inhalt von `supabase/migrations/20260924120000_appointments.sql` einfügen und ausführen.
   Das legt an:
   - Tabelle `appointments` (Vorname, Nachname, Telefon, E-Mail, Angebot, Anschreiben, Termin, Status)
   - Schutz: Besucher können die Tabelle **nicht** lesen, nur freie/belegte Zeiten sehen und buchen
   - Server-seitige Prüfung der Buchungszeiten (siehe unten) — manipulierte Zeiten werden abgelehnt
   - Doppelbuchungen desselben Slots sind technisch ausgeschlossen

Ohne diesen Schritt zeigt die Seite zwar den Kalender, Buchungen schlagen aber fehl.

## 2. E-Mail-Versand (Resend) — Pflicht für Bestätigungsmails

1. Konto auf **resend.com** anlegen (kostenlos bis 3.000 Mails/Monat).
2. Domain **lusides.com** in Resend hinzufügen und die angezeigten **DNS-Einträge**
   (SPF-TXT, DKIM-TXT, optional DMARC) beim Domain-Anbieter eintragen → „Verify“.
3. API-Key erstellen.
4. Supabase → **Edge Functions → Secrets** setzen:

   | Secret | Beispiel | Pflicht |
   |---|---|---|
   | `RESEND_API_KEY` | `re_…` | ja |
   | `MAIL_FROM` | `Lusides <termine@lusides.com>` | ja |
   | `ADMIN_NOTIFY_EMAIL` | deine Adresse für neue Buchungen | ja |
   | `VIDEO_CALL_URL` | fester Teams-/Zoom-/Meet-Raum | optional |

5. Funktion deployen:
   ```
   supabase functions deploy lusides-appointment-notify --project-ref knuktzuqqmrrkpkusren
   ```

Danach bekommt der Kunde automatisch eine Bestätigung (mit Kalendereintrag .ics),
und du eine Benachrichtigung mit allen Angaben.

## 3. Videocall-Link — Entscheidung nötig

Einfachste Lösung: ein **fester Meeting-Raum** (z. B. Teams-Besprechungslink,
Zoom Personal Meeting Room oder Google-Meet-Link) als `VIDEO_CALL_URL` hinterlegen —
dann steht der Link direkt in der Bestätigungsmail.
Ohne `VIDEO_CALL_URL` steht in der Mail, dass der Link separat kommt, und du
schickst ihn selbst.

## 4. Domain lusides.com mit der Website verbinden

Die Seite läuft auf GitHub Pages. Beim Domain-Anbieter eintragen:

| Typ | Name | Wert |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | rdclarity.github.io |

Dann:
1. GitHub → Repo `luside-website` → **Settings → Pages → Custom domain**: `lusides.com` → speichern.
   (Das legt die Datei `CNAME` im Repo an.)
2. Sobald das Zertifikat da ist: **Enforce HTTPS** aktivieren.
3. Supabase → **Authentication → URL Configuration**: `https://lusides.com` als Site URL
   bzw. Redirect-URL eintragen (für den Admin-Login).
4. Danach ist der Admin unter **https://lusides.com/admin** erreichbar.
5. Optional im Anschluss: Canonical-URLs, Sitemap und `llms.txt` von
   `rdclarity.github.io/luside-website/` auf `https://lusides.com/` umstellen.

## 5. Live schalten

Die Änderungen liegen auf dem Branch `claude/lucide-repo-search-stqmef`. Nach Schritt 1
in `main` mergen — GitHub Pages veröffentlicht `main`.

---

## Buchungszeiten (aktuell eingestellt)

- **Tage:** Montag, Dienstag, Donnerstag
- **Zeitfenster:** 07:00–12:00 und 17:00–21:00 Uhr (Wiener Zeit)
- **Termin:** 15 Minuten, danach 30 Minuten Pause → alle 45 Minuten ein Termin
  - Vormittag: 07:00 · 07:45 · 08:30 · 09:15 · 10:00 · 10:45 · 11:30
  - Abend: 17:00 · 17:45 · 18:30 · 19:15 · 20:00 · 20:45
- Buchbar frühestens 2 Stunden und höchstens 60 Tage im Voraus
- Max. 2 offene Termine pro E-Mail-Adresse (Spam-Schutz)

Änderungen an den Zeiten an **zwei** Stellen vornehmen:
`termin-booking.js` (`SCHEDULE`, für die Anzeige) und
`public.is_valid_appointment_slot()` in der SQL-Migration (maßgeblich, serverseitig).

## Im Admin (lusides.com/admin → Termine)

- Anstehende / vergangene / alle Termine
- Status setzen: **Erledigt**, **Absagen** (Slot wird wieder frei), **Wiederherstellen**
- Export als Excel (CSV)
- Hinweis: Beim Absagen wird der Kunde **nicht** automatisch informiert.

## Optional

- **RIMA-Mirror:** Jede Buchung geht bereits als Lead in das RIMA-CRM (wie die anderen
  Formulare). Soll zusätzlich die Tabelle `appointments` live gespiegelt werden, den
  `mirror_to_rima`-Trigger dafür manuell anhängen (siehe `20260910130000_mirror_to_rima.sql`).
