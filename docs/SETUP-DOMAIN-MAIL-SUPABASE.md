# Lusides – Setup: Domain, E-Mail, Rechnungsversand, Datenbank

## 1. Mail an Mihai (Domain + E-Mail)

**Betreff:** lusides.com – DNS für Website, Microsoft 365 und Rechnungsversand

Hallo Mihai,

wir stellen die Website auf **lusides.com** um und brauchen dafür DNS-Einträge, drei Postfächer in Microsoft 365 und Resend für den automatischen Rechnungsversand.

**A) Website (GitHub Pages)**

| Typ   | Name | Wert |
|-------|------|------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153 |
| AAAA  | @    | 2606:50c0:8001::153 |
| AAAA  | @    | 2606:50c0:8002::153 |
| AAAA  | @    | 2606:50c0:8003::153 |
| CNAME | www  | rdclarity.github.io |

Danach im GitHub-Repo `RDclarity/luside-website` unter Settings → Pages die Custom Domain `lusides.com` eintragen und „Enforce HTTPS“ aktivieren. Sobald die Einträge aktiv sind, kurz Bescheid geben, dann lege ich die `CNAME`-Datei an.

**B) Microsoft 365**

1. Die Domain `lusides.com` im M365 Admin Center hinzufügen (Einstellungen → Domänen). Dazu den TXT-Eintrag `MS=ms…` setzen, den M365 anzeigt.
2. DNS-Einträge, wie sie M365 vorgibt:
   - MX `@` → `lusides-com.mail.protection.outlook.com` (Priorität 0)
   - TXT `@` → `v=spf1 include:spf.protection.outlook.com -all`
   - CNAME `autodiscover` → `autodiscover.outlook.com`
   - DKIM: CNAME `selector1._domainkey` und `selector2._domainkey` mit den Werten aus Defender → E-Mail-Authentifizierung → DKIM, danach DKIM aktivieren
   - TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:inquiry@lusides.com` (später auf `p=quarantine` umstellen)
3. Postfächer anlegen:
   - **inquiry@lusides.com** als Benutzerpostfach (Hauptkontakt, Anfragen, Buchungsbenachrichtigungen)
   - **support@lusides.com** als freigegebenes Postfach, Zugriff für Marko und Richard
   - **invoice@lusides.com** als freigegebenes Postfach, Zugriff für Marko und Richard (Absender der Rechnungen, Antworten landen hier)

**C) Resend (automatischer Versand von Bestellschein + Rechnung über invoice@lusides.com)**

1. Account auf resend.com anlegen, unter Domains `lusides.com` hinzufügen (Region EU / Frankfurt).
2. Die DNS-Einträge setzen, die Resend anzeigt. Sie liegen auf der Subdomain `send`, damit sie nicht mit M365 kollidieren:
   - TXT `resend._domainkey` → DKIM-Wert von Resend
   - MX `send` → `feedback-smtp.eu-west-1.amazonses.com` (Priorität 10, genauer Wert laut Resend)
   - TXT `send` → `v=spf1 include:amazonses.com ~all`
3. Auf „Verify“ klicken, dann unter API Keys einen Key mit „Sending access“ für `lusides.com` erstellen.
4. Den Key **nicht per Mail schicken**. Er wird direkt in Supabase als Secret `RESEND_API_KEY` eingetragen (siehe Punkt 2).
5. Optional: in M365 für `inquiry@lusides.com` eine Weiterleitungsregel oder einen Posteingangsordner „Buchungen“ anlegen. Jede Buchung schickt eine Kopie an inquiry@.

Danke dir!
Richard

---

## 2. Supabase (Datenbank + Funktionen)

Projekt: `knuktzuqqmrrkpkusren`

1. **SQL Editor** → nacheinander ausführen:
   1. `supabase/migrations/20261002120000_appointments.sql` (Termine)
   2. `supabase/migrations/20261003100000_billing.sql` (Bestellschein, Rechnungen, Nummernkreise)
2. **Edge Function** `lusides-invoice` deployen:
   ```
   supabase functions deploy lusides-invoice --project-ref knuktzuqqmrrkpkusren --no-verify-jwt
   ```
   (`--no-verify-jwt`, weil die Buchungsseite die Funktion ohne Login aufruft. Die Funktion prüft selbst den Buchungs-Token bzw. den Admin-Login.)
3. **Secrets** (Edge Functions → Secrets):
   - `RESEND_API_KEY` = Key aus Resend
   - optional `MAIL_FROM` = `Lusides <invoice@lusides.com>`
   - optional `MAIL_NOTIFY` = `inquiry@lusides.com`
4. **Admin → Einstellungen** auf der Website: UID-Nummer, IBAN, BIC und Bank eintragen. Sie erscheinen dann auf jeder Rechnung.
5. Neue Tabellen an den RIMA-Mirror hängen (siehe `20260910130000_mirror_to_rima.sql`), falls gewünscht.

## 3. Rechnungslogik (Österreich)

- Fortlaufende, lückenlose Nummern pro Jahr: `RE-2026-0001`, Bestellscheine `B-2026-0001`.
- Rechnungen sind unveränderlich und nicht löschbar (§132 BAO). Korrektur nur per Storno: eigene Nummer, negative Beträge.
- Steuer:
  - Privatkunde oder österreichischer Kunde: 20 % USt, der Preis ist brutto (350 € = 291,67 € netto + 58,33 € USt).
  - EU-Unternehmen mit UID außerhalb Österreichs: Reverse Charge, Nettobetrag, Hinweis auf der Rechnung.
  - Kunde außerhalb der EU (USA): in Österreich nicht steuerbar, USD-Preis ohne USt.
- Bis 400 € brutto gilt die Rechnung als Kleinbetragsrechnung (§11 Abs 6 UStG). Die UID des Leistenden wird trotzdem angedruckt, sobald sie hinterlegt ist.
