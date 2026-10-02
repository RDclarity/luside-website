-- US-Bankverbindung für Rechnungen in USD (ACH / Wire).
-- Nach 20261004100000_project_sheets.sql ausführen. Idempotent.
-- Die Werte selbst werden im Admin unter Einstellungen eingetragen
-- (nicht im öffentlichen Repository).

alter table public.billing_settings
  add column if not exists us_account_name text check (char_length(us_account_name) <= 120),
  add column if not exists us_account      text check (us_account ~ '^[0-9]{4,17}$'),
  add column if not exists us_routing      text check (us_routing ~ '^[0-9]{9}$'),
  add column if not exists us_bank         text check (char_length(us_bank) <= 120);
