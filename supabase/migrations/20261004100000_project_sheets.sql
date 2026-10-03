-- Projektdatenblatt (Schritt 2 nach dem Anfrageformular).
-- Nach 20261003120000_security.sql ausführen. Idempotent.
--
-- Besucher speichern ausschließlich über submit_project_sheet() (geprüft,
-- gebremst); lesen dürfen nur Admins (is_admin()). Jedes Datenblatt bekommt
-- eine Referenz PD-Jahr-Nummer und ein zufälliges Token, mit dem die Edge
-- Function lusides-datasheet genau einmal die PDF-Kopie per E-Mail verschickt.

create table if not exists public.project_sheets (
  id              uuid primary key default gen_random_uuid(),
  ref             text unique,
  token           uuid not null default gen_random_uuid(),
  lang            text not null default 'de' check (lang in ('de','en')),
  -- Ansprechpartner
  name            text not null check (char_length(name) between 2 and 120),
  position        text check (char_length(position) <= 80),
  email           text not null check (char_length(email) <= 254),
  phone           text check (char_length(phone) <= 40),
  -- Unternehmen
  company         text not null check (char_length(company) between 1 and 160),
  legal_form      text check (char_length(legal_form) <= 40),
  industry        text not null check (char_length(industry) <= 60),
  website         text check (char_length(website) <= 200),
  founded_year    integer check (founded_year between 1800 and 2100),
  city            text not null check (char_length(city) <= 80),
  country         text check (char_length(country) <= 10),
  business_model  text check (business_model in ('B2B','B2C','B2B & B2C')),
  succession      text check (succession in ('Ja','Nein')),
  -- Kennzahlen
  employee_count  text not null check (char_length(employee_count) <= 20),
  annual_revenue  text not null check (char_length(annual_revenue) <= 30),
  revenue_trend   text check (char_length(revenue_trend) <= 20),
  locations       integer check (locations between 1 and 999),
  -- Ausgangslage
  areas           text[] not null default '{}',
  situation       text not null check (char_length(situation) between 3 and 2000),
  tried           text check (char_length(tried) <= 2000),
  goal            text not null check (char_length(goal) between 3 and 2000),
  urgency         text not null check (char_length(urgency) <= 30),
  budget          text check (char_length(budget) <= 30),
  decision_maker  boolean not null default false,
  consent_at      timestamptz not null default now(),
  source          text check (char_length(source) <= 80),
  -- Bearbeitung
  status          text not null default 'neu' check (status in ('neu','in Bearbeitung','erledigt')),
  admin_notes     text check (char_length(admin_notes) <= 4000),
  mail_status     text not null default 'offen' check (mail_status in ('offen','gesendet','fehler')),
  mail_error      text,
  created_at      timestamptz not null default now()
);
create index if not exists project_sheets_created_idx on public.project_sheets (created_at desc);

alter table public.project_sheets enable row level security;
revoke all on public.project_sheets from anon, authenticated;
grant select, update on public.project_sheets to authenticated;
drop policy if exists "admins read sheets" on public.project_sheets;
drop policy if exists "admins update sheets" on public.project_sheets;
create policy "admins read sheets" on public.project_sheets for select to authenticated using (public.is_admin());
create policy "admins update sheets" on public.project_sheets for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Nummernkreis um 'sheet' erweitern
create or replace function public.next_number(p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Vienna'))::int;
  v_n integer;
begin
  if p_kind not in ('invoice', 'order', 'sheet') then raise exception 'invalid kind'; end if;
  insert into public.number_counters (kind, year, last) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last = public.number_counters.last + 1
  returning last into v_n;
  return p_prefix || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke execute on function public.next_number(text, text) from public, anon, authenticated;

create or replace function public.submit_project_sheet(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_areas text[];
  v_id uuid; v_token uuid; v_ref text;
  allowed_areas text[] := array['Prozesse & Systeme','Marketing','Finanzen','Digitalisierung & KI','Onlineshop','Sonstiges'];
begin
  if jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  if v_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' or char_length(v_email) > 254
     or coalesce(p->>'phone','') !~ '^[0-9+()/ .\-]*$'
     or (nullif(p->>'website','') is not null and p->>'website' !~* '^(https?://)?[a-z0-9.\-]+\.[a-z]{2,}(/[^\s<>"]*)?$') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(x), '{}') into v_areas
    from jsonb_array_elements_text(case when jsonb_typeof(p->'areas') = 'array' then p->'areas' else '[]'::jsonb end) x
   where x = any(allowed_areas);
  -- Missbrauchsbremse: max. 3 Datenblätter pro E-Mail und Tag, 30 pro Stunde gesamt
  if (select count(*) from public.project_sheets where lower(email) = v_email and created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.project_sheets where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'consent_required' using errcode = 'P0001'; end if;

  begin
    insert into public.project_sheets (lang, name, position, email, phone, company, legal_form, industry, website, founded_year,
      city, country, business_model, succession, employee_count, annual_revenue, revenue_trend, locations,
      areas, situation, tried, goal, urgency, budget, decision_maker, source)
    values (case when p->>'lang' = 'en' then 'en' else 'de' end,
      trim(p->>'name'), nullif(trim(p->>'position'), ''), v_email, nullif(trim(p->>'phone'), ''),
      trim(p->>'company'), nullif(p->>'legal_form', ''), trim(p->>'industry'), nullif(trim(p->>'website'), ''),
      nullif(p->>'founded_year', '')::int, trim(p->>'city'), nullif(p->>'country', ''),
      nullif(p->>'business_model', ''), nullif(p->>'succession', ''),
      trim(p->>'employee_count'), trim(p->>'annual_revenue'), nullif(p->>'revenue_trend', ''), nullif(p->>'locations', '')::int,
      v_areas, trim(p->>'situation'), nullif(trim(p->>'tried'), ''), trim(p->>'goal'), trim(p->>'urgency'),
      nullif(p->>'budget', ''), coalesce((p->>'decision_maker')::boolean, false), left(nullif(p->>'source', ''), 80))
    returning id, token into v_id, v_token;
  exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_input' using errcode = 'P0001';
  end;
  v_ref := public.next_number('sheet', 'PD-');
  update public.project_sheets set ref = v_ref where id = v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'ref', v_ref);
end $$;
revoke execute on function public.submit_project_sheet(jsonb) from public;
grant execute on function public.submit_project_sheet(jsonb) to anon, authenticated;
