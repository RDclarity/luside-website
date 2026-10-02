-- Terminbuchung: 1 Stunde Erstgespräch per Microsoft Teams (350 €).
--
-- Einmalig im Supabase-Dashboard ausführen (SQL Editor → diesen Inhalt
-- einfügen → Run). NUR EINMAL und VOR 20261003100000_billing.sql ausführen –
-- ein erneuter Lauf danach würde die gehärtete Buchungsfunktion überschreiben.
-- Reihenfolge: appointments → billing → security.
--
-- Sicherheitsmodell:
--   * Besucher (anon) haben KEINEN direkten Zugriff auf die Tabelle.
--   * Freie/belegte Slots liefert get_booked_slots() — nur Startzeiten,
--     keine Namen oder E-Mails.
--   * Gebucht wird ausschließlich über book_appointment(), das Slot-Raster,
--     Geschäftszeiten und Doppelbuchungen serverseitig prüft.
--   * Eingeloggte Admins (authenticated, wie bei contacts) dürfen alles
--     lesen und bearbeiten (Status, Teams-Link, Notizen).
--
-- Buchbare Zeiten (müssen zu SLOT_* in termin.html passen):
--   Mo–Fr, Start 09:00–16:00 Uhr Europe/Vienna, volle Stunde, 60 Minuten,
--   frühestens 12 Stunden im Voraus, höchstens 90 Tage im Voraus.

create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  name        text not null check (char_length(name) between 2 and 120),
  company     text check (company is null or char_length(company) <= 160),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  phone       text check (phone is null or char_length(phone) <= 40),
  message     text check (message is null or char_length(message) <= 2000),
  topic       text check (topic is null or char_length(topic) <= 80),
  status      text not null default 'gebucht'
              check (status in ('gebucht', 'bestaetigt', 'abgesagt', 'erledigt')),
  price_eur   integer not null default 350,
  paid        boolean not null default false,
  teams_link  text check (teams_link is null or char_length(teams_link) <= 1000),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  lang        text not null default 'de',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_at > start_at)
);

-- Ein Slot kann nur einmal aktiv belegt sein; abgesagte Termine geben ihn frei.
create unique index if not exists appointments_active_slot
  on public.appointments (start_at) where status <> 'abgesagt';
create index if not exists appointments_start_idx on public.appointments (start_at);

create or replace function public.appointments_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.appointments_touch();

alter table public.appointments enable row level security;

drop policy if exists "admins read appointments" on public.appointments;
create policy "admins read appointments" on public.appointments
  for select to authenticated using (true);
drop policy if exists "admins update appointments" on public.appointments;
create policy "admins update appointments" on public.appointments
  for update to authenticated using (true) with check (true);
drop policy if exists "admins delete appointments" on public.appointments;
create policy "admins delete appointments" on public.appointments
  for delete to authenticated using (true);
drop policy if exists "admins insert appointments" on public.appointments;
create policy "admins insert appointments" on public.appointments
  for insert to authenticated with check (true);

revoke all on public.appointments from anon;
grant select, insert, update, delete on public.appointments to authenticated;

-- Belegte Startzeiten in einem Zeitraum (ohne personenbezogene Daten).
create or replace function public.get_booked_slots(p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql stable security definer set search_path = public as $$
  select start_at from public.appointments
  where status <> 'abgesagt'
    and start_at >= p_from and start_at < p_to
    and p_to - p_from <= interval '120 days'
  order by start_at;
$$;

create or replace function public.book_appointment(
  p_start   timestamptz,
  p_name    text,
  p_email   text,
  p_company text default null,
  p_phone   text default null,
  p_message text default null,
  p_topic   text default null,
  p_lang    text default 'de'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_start at time zone 'Europe/Vienna';
  v_id uuid;
begin
  if extract(isodow from v_local) > 5
     or extract(hour from v_local) < 9 or extract(hour from v_local) > 16
     or extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if p_start < now() + interval '12 hours' or p_start > now() + interval '90 days' then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (start_at, end_at, name, company, email, phone, message, topic, lang)
    values (p_start, p_start + interval '60 minutes',
            trim(p_name), nullif(trim(p_company), ''), lower(trim(p_email)),
            nullif(trim(p_phone), ''), nullif(trim(p_message), ''), nullif(trim(p_topic), ''),
            case when p_lang = 'en' then 'en' else 'de' end)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;
  return v_id;
end $$;

revoke all on function public.get_booked_slots(timestamptz, timestamptz) from public;
revoke all on function public.book_appointment(timestamptz, text, text, text, text, text, text, text) from public;
grant execute on function public.get_booked_slots(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, text, text, text) to anon, authenticated;
