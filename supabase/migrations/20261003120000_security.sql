-- Sicherheits-Härtung (nach Audit). Nach 20261002120000_appointments.sql und
-- 20261003100000_billing.sql ausführen. Idempotent.
--
-- 1. Echte Admin-Rolle: Nur Benutzer in public.admin_users dürfen Admin-Daten
--    lesen/ändern. Vorher genügte JEDER Login ("authenticated") – bei aktivierter
--    Selbstregistrierung hätte sich jeder Fremde Zugriff verschaffen können.
--    WICHTIG zusätzlich im Dashboard: Authentication → Sign In / Providers →
--    "Allow new users to sign up" AUS und "Anonymous sign-ins" AUS.
-- 2. Hilfsfunktionen (next_number, compute_tax) nicht mehr öffentlich aufrufbar.
-- 3. Buchung: Längen-/Formatprüfung, Missbrauchsbremse (max. 1 offene Buchung
--    pro E-Mail, max. 20 Buchungen pro Stunde gesamt), UID muss zum Land passen.
-- 4. Rechnungen: weitere Felder unveränderlich, Storno nicht rückgängig zu machen.

-- ---------- 1. Admins ----------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins eintragen (einmalig, E-Mails anpassen):
--   insert into public.admin_users (user_id, note)
--   select id, email from auth.users where email in ('marko@…', 'richard@…')
--   on conflict do nothing;

-- Termine
drop policy if exists "admins read appointments"   on public.appointments;
drop policy if exists "admins update appointments" on public.appointments;
drop policy if exists "admins delete appointments" on public.appointments;
drop policy if exists "admins insert appointments" on public.appointments;
create policy "admins read appointments"   on public.appointments for select to authenticated using (public.is_admin());
create policy "admins update appointments" on public.appointments for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins insert appointments" on public.appointments for insert to authenticated with check (public.is_admin());
create policy "admins delete appointments" on public.appointments for delete to authenticated
  using (public.is_admin() and not exists (select 1 from public.invoices i where i.appointment_id = appointments.id));

-- Rechnungen & Einstellungen
drop policy if exists "admins read settings"   on public.billing_settings;
drop policy if exists "admins update settings" on public.billing_settings;
drop policy if exists "admins read invoices"   on public.invoices;
drop policy if exists "admins update invoices" on public.invoices;
create policy "admins read settings"   on public.billing_settings for select to authenticated using (public.is_admin());
create policy "admins update settings" on public.billing_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read invoices"   on public.invoices for select to authenticated using (public.is_admin());
create policy "admins update invoices" on public.invoices for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bestehende Tabellen aus der Zeit vor diesem Repo (Kontakt, Newsletter, Analytics):
-- alle Lese-/Änderungsrechte für "authenticated" durch Admin-Only ersetzen.
-- Insert-Policies für Besucher (anon) bleiben unangetastet.
do $$
declare t text; p record;
begin
  foreach t in array array['contacts','newsletter_subscribers','page_visits','page_visit_durations','conversion_events'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t
               and cmd in ('SELECT','UPDATE','DELETE','ALL')
               and ('authenticated' = any(roles) or 'public' = any(roles))
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('drop policy if exists "admins read %s" on public.%I', t, t);
    execute format('create policy "admins read %s" on public.%I for select to authenticated using (public.is_admin())', t, t);
    execute format('revoke select, update, delete on public.%I from anon', t);
  end loop;
end $$;

-- ---------- 2. Funktionsrechte ----------
alter default privileges in schema public revoke execute on functions from anon, authenticated;
revoke execute on function public.next_number(text, text) from public, anon, authenticated;
revoke execute on function public.compute_tax(text, text, text) from public, anon, authenticated;

create or replace function public.next_number(p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Vienna'))::int;
  v_n integer;
begin
  if p_kind not in ('invoice', 'order') then raise exception 'invalid kind'; end if;
  insert into public.number_counters (kind, year, last) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last = public.number_counters.last + 1
  returning last into v_n;
  return p_prefix || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke execute on function public.next_number(text, text) from public, anon, authenticated;

create or replace function public.cancel_invoice(p_invoice uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_no text; i public.invoices;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
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
revoke execute on function public.cancel_invoice(uuid) from public, anon;
grant execute on function public.cancel_invoice(uuid) to authenticated;

alter table public.appointments add column if not exists price numeric(10,2);

-- ---------- 3a. Steuer/Währung: Währung folgt der angezeigten Region ----------
create or replace function public.compute_tax(p_region text, p_country text, p_uid text,
  out o_currency text, out o_net numeric, out o_vat_rate numeric, out o_vat numeric, out o_gross numeric,
  out o_treatment text, out o_note text)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.billing_settings;
  eu text[] := array['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
  c text := upper(coalesce(p_country, ''));
  us boolean := upper(coalesce(p_region, '')) = 'US';
begin
  select * into s from public.billing_settings where id;
  if us then
    -- US-Preis gilt nur für Kunden außerhalb der EU (sonst wäre österreichische USt fällig)
    if c = any(eu) then raise exception 'region_mismatch' using errcode = 'P0001'; end if;
    o_currency := 'USD'; o_treatment := 'NON_EU';
    o_net := s.price_usd; o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Not subject to Austrian VAT (place of supply outside the EU, §3a UStG). / Nicht im Inland steuerbare Leistung.';
    return;
  end if;
  o_currency := 'EUR';
  if c = any(eu) and c <> 'AT' and nullif(trim(p_uid), '') is not null and nullif(trim(s.uid), '') is not null then
    o_treatment := 'REVERSE_CHARGE';
    o_net := round(s.price_eur_gross / (1 + s.vat_rate / 100), 2);
    o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge, §19 Abs 1 UStG / Art. 196 MwSt-RL). / Reverse charge: VAT to be accounted for by the recipient.';
  elsif c = any(eu) then
    o_treatment := 'AT_20';
    o_gross := s.price_eur_gross; o_vat_rate := s.vat_rate;
    o_net := round(o_gross / (1 + o_vat_rate / 100), 2); o_vat := o_gross - o_net; o_note := null;
  else
    o_treatment := 'NON_EU';
    o_net := round(s.price_eur_gross / (1 + s.vat_rate / 100), 2);
    o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Nicht im Inland steuerbare Leistung (§3a UStG). / Not subject to Austrian VAT.';
  end if;
end $$;
revoke execute on function public.compute_tax(text, text, text) from public, anon, authenticated;

-- ---------- 3. Buchung härten ----------
alter table public.appointments drop constraint if exists appointments_billing_len;
alter table public.appointments add constraint appointments_billing_len check (
  char_length(coalesce(billing_street,'')) <= 160 and char_length(coalesce(billing_zip,'')) <= 20 and
  char_length(coalesce(billing_city,'')) <= 80 and char_length(coalesce(billing_company,'')) <= 160 and
  (billing_country is null or billing_country ~ '^[A-Z]{2}$') and
  (billing_uid is null or billing_uid ~ '^[A-Z]{2}[0-9A-Z]{2,13}$')) not valid;

create or replace function public.book_appointment(
  p_start timestamptz, p_name text, p_email text, p_company text default null, p_phone text default null,
  p_message text default null, p_topic text default null, p_lang text default 'de', p_region text default 'EU',
  p_street text default null, p_zip text default null, p_city text default null, p_country text default null, p_uid text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_start at time zone 'Europe/Vienna';
  v_region text := case when upper(coalesce(p_region,'')) = 'US' then 'US' else 'EU' end;
  v_min_h int := case when v_region = 'US' then 15 else 9 end;
  v_max_h int := case when v_region = 'US' then 18 else 16 end;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_country text := upper(trim(coalesce(p_country, '')));
  v_uid text := nullif(upper(regexp_replace(coalesce(p_uid, ''), '[\s.\-]', '', 'g')), '');
  v_id uuid; v_token uuid; v_order text; v_inv text; t record;
  s public.billing_settings;
begin
  -- Termin-Raster
  if extract(isodow from v_local) > 5
     or extract(hour from v_local) < v_min_h or extract(hour from v_local) > v_max_h
     or extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if p_start < now() + interval '12 hours' or p_start > now() + interval '90 days' then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  -- Pflichtfelder, Längen, Formate
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120
     or v_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' or char_length(v_email) > 254
     or char_length(coalesce(p_company,'')) > 160 or char_length(coalesce(p_phone,'')) > 40
     or coalesce(p_phone,'') !~ '^[0-9+()/ .\-]*$'
     or char_length(coalesce(p_message,'')) > 2000 or char_length(coalesce(p_topic,'')) > 80 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_street,''))) not between 3 and 160 or char_length(trim(coalesce(p_city,''))) not between 2 and 80
     or char_length(coalesce(p_zip,'')) > 20 or v_country !~ '^[A-Z]{2}$' or v_country = 'XX' then
    raise exception 'billing_required' using errcode = 'P0001';
  end if;
  -- UID muss zum Land passen (Griechenland: EL), sonst kein Reverse Charge
  if v_uid is not null and (v_uid !~ '^[A-Z]{2}[0-9A-Z]{2,13}$'
       or left(v_uid, 2) <> case when v_country = 'GR' then 'EL' else v_country end) then
    raise exception 'invalid_uid' using errcode = 'P0001';
  end if;
  -- Missbrauchsbremse
  if exists (select 1 from public.appointments where lower(email) = v_email and status <> 'abgesagt' and start_at > now()) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;
  if (select count(*) from public.appointments where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into s from public.billing_settings where id;
  select * into t from public.compute_tax(v_region, v_country, v_uid);

  begin
    insert into public.appointments (start_at, end_at, name, company, email, phone, message, topic, lang,
      region, currency, price_eur, price, billing_name, billing_company, billing_street, billing_zip, billing_city, billing_country, billing_uid)
    values (p_start, p_start + interval '60 minutes',
            trim(p_name), nullif(trim(p_company), ''), v_email,
            nullif(trim(p_phone), ''), nullif(trim(p_message), ''), nullif(trim(p_topic), ''),
            case when p_lang = 'en' then 'en' else 'de' end,
            v_region, t.o_currency, round(t.o_gross)::int, t.o_gross,
            trim(p_name), nullif(trim(p_company), ''), trim(p_street), nullif(trim(p_zip), ''), trim(p_city), v_country, v_uid)
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
revoke execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_booked_slots(timestamptz, timestamptz) to anon, authenticated;

-- ---------- 4. Rechnungen: mehr unveränderliche Felder, Storno endgültig ----------
create or replace function public.invoices_protect()
returns trigger language plpgsql as $$
begin
  if (new.invoice_no, new.kind, new.refers_to, new.appointment_id, new.net_amount, new.vat_rate, new.vat_amount,
      new.gross_amount, new.currency, new.quantity, new.tax_treatment, new.tax_note,
      new.customer_name, new.customer_company, new.customer_street, new.customer_zip, new.customer_city,
      new.customer_country, new.customer_uid, new.customer_email, new.issue_date, new.service_date, new.description)
     is distinct from
     (old.invoice_no, old.kind, old.refers_to, old.appointment_id, old.net_amount, old.vat_rate, old.vat_amount,
      old.gross_amount, old.currency, old.quantity, old.tax_treatment, old.tax_note,
      old.customer_name, old.customer_company, old.customer_street, old.customer_zip, old.customer_city,
      old.customer_country, old.customer_uid, old.customer_email, old.issue_date, old.service_date, old.description) then
    raise exception 'Rechnungsinhalte sind unveränderlich – bitte stornieren und neu ausstellen.';
  end if;
  if old.status = 'storniert' and new.status <> 'storniert' then
    raise exception 'Eine stornierte Rechnung kann nicht wieder geöffnet werden.';
  end if;
  return new;
end $$;

-- ---------- Rate-Limit-Tabelle für Edge Functions (Chat, Lead-Intake) ----------
create table if not exists public.rate_limits (
  bucket     text not null,
  window_start timestamptz not null,
  hits       integer not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_bucket text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
        v_hits integer;
begin
  insert into public.rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit(text, integer, interval) from public, anon, authenticated;
-- (nur über den Service-Role-Key der Edge Functions aufrufbar)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.hit_rate_limit(text, integer, interval) to service_role;
  end if;
end $$;
