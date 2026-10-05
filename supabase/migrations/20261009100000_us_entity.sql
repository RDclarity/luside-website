-- US-Kunden: Rechnungen stellt die Katalan Group LLC aus (Zahlung auf das Chase-Konto), eigener
-- Nummernkreis US-JJJJ-NNNN. EU-Kunden: unverändert Legatech GmbH & Co KG (RE-JJJJ-NNNN).
-- Nach 20261008110000_withdrawals.sql ausführen. Idempotent.

alter table public.billing_settings
  add column if not exists us_legal_name text not null default 'Katalan Group LLC' check (char_length(us_legal_name) <= 160),
  add column if not exists us_street     text check (us_street is null or char_length(us_street) <= 160),
  add column if not exists us_city_line  text check (us_city_line is null or char_length(us_city_line) <= 160),
  add column if not exists us_country    text not null default 'USA' check (char_length(us_country) <= 60),
  add column if not exists us_ein        text check (us_ein is null or char_length(us_ein) <= 20),
  add column if not exists us_email      text check (us_email is null or char_length(us_email) <= 254),
  add column if not exists us_phone      text check (us_phone is null or char_length(us_phone) <= 40);
update public.billing_settings set us_account_name = 'Katalan Group LLC' where id;

create or replace function public.next_number(p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Vienna'))::int;
  v_n integer;
begin
  if p_kind not in ('invoice', 'invoice_us', 'order', 'sheet') then raise exception 'invalid kind'; end if;
  insert into public.number_counters (kind, year, last) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last = public.number_counters.last + 1
  returning last into v_n;
  return p_prefix || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke execute on function public.next_number(text, text) from public, anon, authenticated;

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
    -- US-Rechnungen stellt die Katalan Group LLC aus: kein österreichischer Steuerhinweis
    o_note := null;
    return;
  end if;
  o_currency := 'EUR';
  if c = any(eu) and c <> 'AT' and nullif(trim(p_uid), '') is not null and nullif(trim(s.uid), '') is not null then
    o_treatment := 'REVERSE_CHARGE';
    o_net := round(s.price_eur_gross / (1 + s.vat_rate / 100), 2);
    o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge, §19 Abs 1 UStG / Art. 196 MwSt-RL).';
  elsif c = any(eu) then
    o_treatment := 'AT_20';
    o_gross := s.price_eur_gross; o_vat_rate := s.vat_rate;
    o_net := round(o_gross / (1 + o_vat_rate / 100), 2); o_vat := o_gross - o_net; o_note := null;
  else
    o_treatment := 'NON_EU';
    o_net := round(s.price_eur_gross / (1 + s.vat_rate / 100), 2);
    o_vat_rate := 0; o_vat := 0; o_gross := o_net;
    o_note := 'Nicht im Inland steuerbare Leistung (§3a UStG).';
  end if;
end $$;
revoke execute on function public.compute_tax(text, text, text) from public, anon, authenticated;

create or replace function public.cancel_invoice(p_invoice uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_no text; i public.invoices;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into i from public.invoices where id = p_invoice for update;
  if not found or i.kind <> 'rechnung' or i.status = 'storniert' then raise exception 'invalid_invoice'; end if;
  -- Storno im Nummernkreis des ausstellenden Unternehmens (USD = Katalan Group LLC)
  v_no := case when i.currency = 'USD' then public.next_number('invoice_us', 'US-') else public.next_number('invoice', 'RE-') end;
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

create or replace function public.book_appointment(
  p_start timestamptz, p_name text, p_email text, p_company text default null, p_phone text default null,
  p_message text default null, p_topic text default null, p_lang text default 'de', p_region text default 'EU',
  p_street text default null, p_zip text default null, p_city text default null, p_country text default null, p_uid text default null,
  p_meeting_type text default 'video', p_tz text default null,
  p_terms boolean default false, p_early_start boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_start at time zone 'Europe/Vienna';
  -- Sprache bestimmt Region und Währung: Deutsch = Euro, Englisch = US-Dollar (p_region wird ignoriert)
  v_region text := case when p_lang = 'en' then 'US' else 'EU' end;
  v_min_h int := case when v_region = 'US' then 15 else 9 end;
  v_max_h int := case when v_region = 'US' then 18 else 16 end;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_country text := upper(trim(coalesce(p_country, '')));
  v_uid text := nullif(upper(regexp_replace(coalesce(p_uid, ''), '[\s.\-]', '', 'g')), '');
  v_meeting text := lower(trim(coalesce(p_meeting_type, 'video')));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_tz text := nullif(trim(coalesce(p_tz, '')), '');
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
  -- Österreichische Feiertage und manuell gesperrte Tage
  if public.at_holiday(v_local::date)
     or exists (select 1 from public.blocked_dates where day = v_local::date) then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  -- AGB müssen akzeptiert sein
  if not coalesce(p_terms, false) then
    raise exception 'terms_required' using errcode = 'P0001';
  end if;
  -- Pflichtfelder, Längen, Formate
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120
     or v_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' or char_length(v_email) > 254
     or char_length(coalesce(p_company,'')) > 160 or char_length(coalesce(p_phone,'')) > 40
     or coalesce(p_phone,'') !~ '^[0-9+()/ .\-]*$'
     or char_length(coalesce(p_message,'')) > 2000 or char_length(coalesce(p_topic,'')) > 80
     or v_meeting not in ('video', 'phone') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  -- Telefongespräch: Rückrufnummer ist Pflicht (mind. 6 Ziffern)
  if v_meeting = 'phone' and char_length(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g')) < 6 then
    raise exception 'phone_required' using errcode = 'P0001';
  end if;
  -- Zeitzone des Kunden (nur zur Anzeige in Bestellschein/Rechnung); Ungültiges wird verworfen
  if v_tz is not null and (char_length(v_tz) > 64 or v_tz !~ '^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$') then
    v_tz := null;
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
      region, currency, price_eur, price, billing_name, billing_company, billing_street, billing_zip, billing_city, billing_country, billing_uid,
      meeting_type, customer_tz, terms_accepted_at, early_start_consent_at)
    values (p_start, p_start + interval '30 minutes',
            trim(p_name), nullif(trim(p_company), ''), v_email,
            v_phone, nullif(trim(p_message), ''), nullif(trim(p_topic), ''),
            case when p_lang = 'en' then 'en' else 'de' end,
            v_region, t.o_currency, round(t.o_gross)::int, t.o_gross,
            trim(p_name), nullif(trim(p_company), ''), trim(p_street), nullif(trim(p_zip), ''), trim(p_city), v_country, v_uid,
            v_meeting, v_tz, case when p_terms then now() end, case when p_early_start then now() end)
    returning id, booking_token into v_id, v_token;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  v_order := public.next_number('order', 'B-');
  update public.appointments set order_no = v_order where id = v_id;

  -- Eigener Nummernkreis je ausstellendem Unternehmen: EUR = Legatech (RE-), USD = Katalan Group LLC (US-)
  v_inv := case when t.o_currency = 'USD' then public.next_number('invoice_us', 'US-') else public.next_number('invoice', 'RE-') end;
  insert into public.invoices (invoice_no, appointment_id, service_date, due_date,
    customer_name, customer_company, customer_street, customer_zip, customer_city, customer_country, customer_uid, customer_email,
    description, currency, net_amount, vat_rate, vat_amount, gross_amount, tax_treatment, tax_note, lang)
  select v_inv, a.id, (a.start_at at time zone 'Europe/Vienna')::date,
         least((a.start_at at time zone 'Europe/Vienna')::date, (now() at time zone 'Europe/Vienna')::date + s.payment_days),
         a.billing_name, a.billing_company, a.billing_street, a.billing_zip, a.billing_city, a.billing_country, a.billing_uid, a.email,
         case when a.lang = 'en' and a.meeting_type = 'phone' then 'Initial consultation, 30 minutes, by phone'
              when a.lang = 'en'                             then 'Initial consultation, 30 minutes, via Microsoft Teams (video)'
              when a.meeting_type = 'phone'                  then 'Erstgespräch, 30 Minuten, per Telefon'
              else                                                'Erstgespräch, 30 Minuten, per Microsoft Teams (Video)' end,
         t.o_currency, t.o_net, t.o_vat_rate, t.o_vat, t.o_gross, t.o_treatment, t.o_note, a.lang
  from public.appointments a where a.id = v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'order_no', v_order, 'invoice_no', v_inv,
                            'currency', t.o_currency, 'gross', t.o_gross, 'net', t.o_net,
                            'tax_treatment', t.o_treatment, 'meeting_type', v_meeting, 'start', p_start);
end $$;
revoke execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;
