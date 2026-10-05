-- Erstgespräch: 30 Minuten, 300 € (EU, inkl. USt) bzw. 490 USD (USA).
-- Nach 20261007100000_booking_channel.sql ausführen. Idempotent.

alter table public.billing_settings alter column price_eur_gross set default 300.00;
alter table public.billing_settings alter column price_usd set default 490.00;
update public.billing_settings set price_eur_gross = 300.00, price_usd = 490.00 where id;

-- Verbraucher: ausdrückliches Verlangen auf Beginn vor Ablauf der Widerrufsfrist + Kenntnisnahme
-- des Erlöschens (§ 10, § 18 Abs 1 Z 1 FAGG) – Zeitpunkt wird gespeichert und im Bestellschein bestätigt.
alter table public.appointments add column if not exists early_start_consent_at timestamptz;
alter table public.appointments add column if not exists terms_accepted_at timestamptz;

drop function if exists public.book_appointment(timestamptz, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);

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

  v_inv := public.next_number('invoice', 'RE-');
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
