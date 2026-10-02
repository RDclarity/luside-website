-- Bestellschein + Rechnungssystem (fortlaufend, lückenlos) für die Terminbuchung.
-- Setzt 20261002120000_appointments.sql voraus. Idempotent.
--
-- Rechtlicher Rahmen (Österreich):
--   * §11 UStG: Rechnungsmerkmale (Name/Anschrift Leistender + Empfänger,
--     Menge/Bezeichnung, Leistungsdatum, Entgelt, Steuersatz/-betrag,
--     Ausstellungsdatum, fortlaufende Nummer, UID des Leistenden).
--     Bis 400 € brutto genügt eine Kleinbetragsrechnung (§11 Abs 6).
--   * §132 BAO: 7 Jahre Aufbewahrung → Rechnungen werden nie gelöscht,
--     sondern mit einer eigenen Stornorechnung (Gutschrift) neutralisiert.
--   * Ort der sonstigen Leistung (Beratung):
--       - Privatkunde (B2C), egal woher in der EU → Österreich, 20 % USt.
--       - Unternehmer mit UID aus einem anderen EU-Staat → Reverse Charge
--         (§3a Abs 6 / §19 Abs 1 UStG), ohne USt, Hinweis + beide UIDs.
--       - Kunde außerhalb der EU (z. B. USA) → in Österreich nicht steuerbar
--         (§3a Abs 6 bzw. Abs 14 Z 9 UStG), ohne USt.
--   Der Buchungspreis ist der Endpreis (brutto) für Privatkunden in Österreich;
--   bei Reverse Charge / Drittland wird der Nettobetrag verrechnet.

-- ---------- Firmendaten & Preise (eine Zeile) ----------
create table if not exists public.billing_settings (
  id              boolean primary key default true check (id),
  legal_name      text not null default 'Legatech GmbH & Co KG',
  brand           text not null default 'Lusides',
  street          text not null default 'Endresstraße 50/V3',
  zip             text not null default '1230',
  city            text not null default 'Wien',
  country         text not null default 'Österreich',
  uid             text,                 -- ATU… (Pflicht ab 400 € brutto bzw. bei Reverse Charge)
  fn              text not null default 'FN 614735 y',
  court           text not null default 'Handelsgericht Wien',
  email_invoice   text not null default 'invoice@lusides.com',
  email_contact   text not null default 'inquiry@lusides.com',
  phone           text not null default '+43 660 3607188',
  iban            text,
  bic             text,
  bank            text,
  vat_rate        numeric(5,2) not null default 20.00,
  price_eur_gross numeric(10,2) not null default 350.00,
  price_usd       numeric(10,2) not null default 390.00,
  payment_days    integer not null default 14,
  updated_at      timestamptz not null default now()
);
insert into public.billing_settings (id) values (true) on conflict (id) do nothing;

-- ---------- Lückenlose Nummernkreise ----------
create table if not exists public.number_counters (
  kind  text not null,          -- 'invoice' | 'order'
  year  integer not null,
  last  integer not null default 0,
  primary key (kind, year)
);

create or replace function public.next_number(p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Vienna'))::int;
  v_n integer;
begin
  insert into public.number_counters (kind, year, last) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last = public.number_counters.last + 1
  returning last into v_n;
  return p_prefix || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke all on function public.next_number(text, text) from public;

-- ---------- Erweiterung der Termine ----------
alter table public.appointments
  add column if not exists region          text not null default 'EU' check (region in ('EU','US')),
  add column if not exists currency        text not null default 'EUR' check (currency in ('EUR','USD')),
  add column if not exists billing_name    text,
  add column if not exists billing_company text,
  add column if not exists billing_street  text,
  add column if not exists billing_zip     text,
  add column if not exists billing_city    text,
  add column if not exists billing_country text,      -- ISO-3166 alpha-2, z. B. AT, DE, US
  add column if not exists billing_uid     text,
  add column if not exists order_no        text unique,
  add column if not exists booking_token   uuid not null default gen_random_uuid(),
  add column if not exists mail_status     text not null default 'offen' check (mail_status in ('offen','gesendet','fehler')),
  add column if not exists mail_error      text;

-- Buchbare Startzeiten (Wiener Zeit): EU 09–16 Uhr, USA 15–18 Uhr (= 9–12 Uhr New York)
-- ---------- Rechnungen ----------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text not null unique,
  kind            text not null default 'rechnung' check (kind in ('rechnung','storno')),
  refers_to       uuid references public.invoices(id),
  appointment_id  uuid references public.appointments(id) on delete restrict,
  issue_date      date not null default (now() at time zone 'Europe/Vienna')::date,
  service_date    date not null,
  due_date        date,
  customer_name   text not null,
  customer_company text,
  customer_street text,
  customer_zip    text,
  customer_city   text,
  customer_country text,
  customer_uid    text,
  customer_email  text not null,
  description     text not null,
  quantity        numeric(10,2) not null default 1,
  currency        text not null check (currency in ('EUR','USD')),
  net_amount      numeric(10,2) not null,
  vat_rate        numeric(5,2) not null,
  vat_amount      numeric(10,2) not null,
  gross_amount    numeric(10,2) not null,
  tax_treatment   text not null check (tax_treatment in ('AT_20','REVERSE_CHARGE','NON_EU')),
  tax_note        text,
  status          text not null default 'offen' check (status in ('offen','bezahlt','storniert')),
  paid_at         timestamptz,
  sent_at         timestamptz,
  lang            text not null default 'de',
  created_at      timestamptz not null default now()
);
create index if not exists invoices_appt_idx on public.invoices(appointment_id);

alter table public.billing_settings enable row level security;
alter table public.number_counters  enable row level security;
alter table public.invoices         enable row level security;

drop policy if exists "admins read settings" on public.billing_settings;
create policy "admins read settings" on public.billing_settings for select to authenticated using (true);
drop policy if exists "admins update settings" on public.billing_settings;
create policy "admins update settings" on public.billing_settings for update to authenticated using (true) with check (true);
drop policy if exists "admins read invoices" on public.invoices;
create policy "admins read invoices" on public.invoices for select to authenticated using (true);
-- Admins dürfen nur Status/Zahlung ändern – Beträge/Nummern sind über Trigger geschützt.
drop policy if exists "admins update invoices" on public.invoices;
create policy "admins update invoices" on public.invoices for update to authenticated using (true) with check (true);
-- Keine DELETE-Policy: Rechnungen werden nie gelöscht (§132 BAO).

revoke all on public.billing_settings, public.number_counters, public.invoices from anon;
grant select, update on public.billing_settings to authenticated;
grant select, update on public.invoices to authenticated;

create or replace function public.invoices_protect()
returns trigger language plpgsql as $$
begin
  if (new.invoice_no, new.kind, new.net_amount, new.vat_amount, new.gross_amount, new.currency,
      new.customer_name, new.issue_date, new.service_date, new.description)
     is distinct from
     (old.invoice_no, old.kind, old.net_amount, old.vat_amount, old.gross_amount, old.currency,
      old.customer_name, old.issue_date, old.service_date, old.description) then
    raise exception 'Rechnungsinhalte sind unveränderlich – bitte stornieren und neu ausstellen.';
  end if;
  return new;
end $$;
drop trigger if exists invoices_protect on public.invoices;
create trigger invoices_protect before update on public.invoices
  for each row execute function public.invoices_protect();

-- Termine mit Rechnung dürfen nicht gelöscht werden (Rechnung bleibt sonst verwaist).
drop policy if exists "admins delete appointments" on public.appointments;
create policy "admins delete appointments" on public.appointments
  for delete to authenticated using (not exists (select 1 from public.invoices i where i.appointment_id = appointments.id));

-- ---------- Steuerberechnung ----------
create or replace function public.compute_tax(p_region text, p_country text, p_uid text,
  out o_currency text, out o_net numeric, out o_vat_rate numeric, out o_vat numeric, out o_gross numeric,
  out o_treatment text, out o_note text)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.billing_settings;
  eu text[] := array['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
  c text := upper(coalesce(nullif(trim(p_country), ''), case when p_region = 'US' then 'US' else 'AT' end));
begin
  select * into s from public.billing_settings where id;
  if c = any(eu) then
    o_currency := 'EUR';
    if c <> 'AT' and nullif(trim(p_uid), '') is not null then
      o_treatment := 'REVERSE_CHARGE';
      o_net := round(s.price_eur_gross / (1 + s.vat_rate / 100), 2);
      o_vat_rate := 0; o_vat := 0; o_gross := o_net;
      o_note := 'Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge, Art. 196 MwStSystRL / §19 Abs 1 UStG).';
    else
      o_treatment := 'AT_20';
      o_gross := s.price_eur_gross;
      o_vat_rate := s.vat_rate;
      o_net := round(o_gross / (1 + o_vat_rate / 100), 2);
      o_vat := o_gross - o_net;
      o_note := null;
    end if;
  else
    o_currency := case when p_region = 'US' or c = 'US' then 'USD' else 'EUR' end;
    o_treatment := 'NON_EU';
    o_net := case when o_currency = 'USD' then s.price_usd else round(s.price_eur_gross / (1 + s.vat_rate / 100), 2) end;
    o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Nicht im Inland steuerbare Leistung (§3a UStG) – Not subject to Austrian VAT.';
  end if;
end $$;
revoke all on function public.compute_tax(text, text, text) from public;

-- ---------- Buchung: Termin + Bestellschein-Nr. + Rechnung in einem Schritt ----------
drop function if exists public.book_appointment(timestamptz, text, text, text, text, text, text, text);
create or replace function public.book_appointment(
  p_start   timestamptz,
  p_name    text,
  p_email   text,
  p_company text default null,
  p_phone   text default null,
  p_message text default null,
  p_topic   text default null,
  p_lang    text default 'de',
  p_region  text default 'EU',
  p_street  text default null,
  p_zip     text default null,
  p_city    text default null,
  p_country text default null,
  p_uid     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_start at time zone 'Europe/Vienna';
  v_region text := case when upper(p_region) = 'US' then 'US' else 'EU' end;
  v_min_h int := case when v_region = 'US' then 15 else 9 end;
  v_max_h int := case when v_region = 'US' then 18 else 16 end;
  v_id uuid; v_token uuid; v_order text; v_inv text; t record;
  s public.billing_settings;
begin
  if extract(isodow from v_local) > 5
     or extract(hour from v_local) < v_min_h or extract(hour from v_local) > v_max_h
     or extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if p_start < now() + interval '12 hours' or p_start > now() + interval '90 days' then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if char_length(coalesce(trim(p_street),'')) < 3 or char_length(coalesce(trim(p_city),'')) < 2 then
    raise exception 'billing_required' using errcode = 'P0001';
  end if;

  select * into s from public.billing_settings where id;
  select * into t from public.compute_tax(v_region, p_country, p_uid);

  begin
    insert into public.appointments (start_at, end_at, name, company, email, phone, message, topic, lang,
      region, currency, price_eur, billing_name, billing_company, billing_street, billing_zip, billing_city, billing_country, billing_uid)
    values (p_start, p_start + interval '60 minutes',
            trim(p_name), nullif(trim(p_company), ''), lower(trim(p_email)),
            nullif(trim(p_phone), ''), nullif(trim(p_message), ''), nullif(trim(p_topic), ''),
            case when p_lang = 'en' then 'en' else 'de' end,
            v_region, t.o_currency, round(t.o_gross)::int,
            trim(p_name), nullif(trim(p_company), ''), trim(p_street), nullif(trim(p_zip), ''), trim(p_city),
            upper(coalesce(nullif(trim(p_country), ''), case when v_region = 'US' then 'US' else 'AT' end)),
            nullif(upper(replace(trim(coalesce(p_uid,'')), ' ', '')), ''))
    returning id, booking_token into v_id, v_token;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  v_order := public.next_number('order', 'B-');
  update public.appointments set order_no = v_order where id = v_id;

  v_inv := public.next_number('invoice', 'RE-');
  insert into public.invoices (invoice_no, appointment_id, service_date, due_date,
    customer_name, customer_company, customer_street, customer_zip, customer_city, customer_country, customer_uid, customer_email,
    description, currency, net_amount, vat_rate, vat_amount, gross_amount, tax_treatment, tax_note, lang)
  select v_inv, a.id, (a.start_at at time zone 'Europe/Vienna')::date,
         least((a.start_at at time zone 'Europe/Vienna')::date, (now() at time zone 'Europe/Vienna')::date + s.payment_days),
         a.billing_name, a.billing_company, a.billing_street, a.billing_zip, a.billing_city, a.billing_country, a.billing_uid, a.email,
         case when a.lang = 'en' then 'Initial consultation, 60 minutes, via Microsoft Teams'
              else 'Erstgespräch, 60 Minuten, per Microsoft Teams' end,
         t.o_currency, t.o_net, t.o_vat_rate, t.o_vat, t.o_gross, t.o_treatment, t.o_note, a.lang
  from public.appointments a where a.id = v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'order_no', v_order, 'invoice_no', v_inv,
                            'currency', t.o_currency, 'gross', t.o_gross);
end $$;

revoke all on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- Storno (Admin): Gegenrechnung mit eigener Nummer ----------
create or replace function public.cancel_invoice(p_invoice uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_no text; i public.invoices;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;
  select * into i from public.invoices where id = p_invoice for update;
  if not found or i.kind <> 'rechnung' or i.status = 'storniert' then raise exception 'invalid_invoice'; end if;
  v_no := public.next_number('invoice', 'RE-');
  insert into public.invoices (invoice_no, kind, refers_to, appointment_id, service_date,
    customer_name, customer_company, customer_street, customer_zip, customer_city, customer_country, customer_uid, customer_email,
    description, quantity, currency, net_amount, vat_rate, vat_amount, gross_amount, tax_treatment, tax_note, status, lang)
  values (v_no, 'storno', i.id, i.appointment_id, i.service_date,
    i.customer_name, i.customer_company, i.customer_street, i.customer_zip, i.customer_city, i.customer_country, i.customer_uid, i.customer_email,
    case when i.lang = 'en' then 'Cancellation of invoice ' else 'Storno zu Rechnung ' end || i.invoice_no,
    -1, i.currency, -i.net_amount, i.vat_rate, -i.vat_amount, -i.gross_amount, i.tax_treatment, i.tax_note, 'storniert', i.lang);
  update public.invoices set status = 'storniert' where id = i.id;
  return v_no;
end $$;
revoke all on function public.cancel_invoice(uuid) from public;
grant execute on function public.cancel_invoice(uuid) to authenticated;
