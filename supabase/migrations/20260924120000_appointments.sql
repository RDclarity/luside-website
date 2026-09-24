-- Terminbuchung: kostenloses 15-Minuten-Gespräch per Videocall (termin.html).
--
-- Anders als 20260910130000_mirror_to_rima.sql ist diese Datei eine echte,
-- ausführbare Migration (enthält keine Secrets). Einspielen über den
-- Supabase SQL Editor oder `supabase db push`.
--
-- Zugriff:
--   * Besucher (anon) sehen die Tabelle NICHT. Sie können nur
--       - get_booked_slots()   → belegte Startzeiten (ohne Personendaten)
--       - book_appointment()   → einen Termin in einem gültigen, freien Slot anlegen
--   * Eingeloggte Admins (authenticated, admin.html) lesen/ändern alles.
--
-- Die Verfügbarkeitsregeln stehen doppelt: hier (maßgeblich, serverseitig)
-- und in termin-booking.js (SCHEDULE, nur für die Anzeige). Bei Änderungen
-- beide Stellen anpassen.

create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  slot_start   timestamptz not null,
  first_name   text not null check (char_length(first_name) between 1 and 100),
  last_name    text not null check (char_length(last_name) between 1 and 100),
  phone        text not null check (char_length(phone) between 5 and 40),
  email        text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  offer        text not null check (char_length(offer) between 1 and 100),
  message      text not null check (char_length(message) between 1 and 2000),
  status       text not null default 'booked' check (status in ('booked', 'done', 'cancelled')),
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Ein Slot kann nur einmal aktiv gebucht sein; abgesagte Termine geben ihn wieder frei.
create unique index if not exists appointments_active_slot_unique
  on public.appointments (slot_start)
  where status <> 'cancelled';

create index if not exists appointments_slot_start_idx on public.appointments (slot_start);

alter table public.appointments enable row level security;

drop policy if exists "Admins can read appointments" on public.appointments;
create policy "Admins can read appointments" on public.appointments
  for select to authenticated using (true);

drop policy if exists "Admins can update appointments" on public.appointments;
create policy "Admins can update appointments" on public.appointments
  for update to authenticated using (true) with check (true);

drop policy if exists "Admins can delete appointments" on public.appointments;
create policy "Admins can delete appointments" on public.appointments
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Verfügbarkeit (Zeitzone Europe/Vienna)
--   Tage:     Montag, Dienstag, Donnerstag
--   Fenster:  07:00–12:00 und 17:00–21:00
--   Termin:   15 Minuten, danach 30 Minuten Pause → alle 45 Minuten ein Slot
--             Vormittag: 07:00 07:45 08:30 09:15 10:00 10:45 11:30
--             Abend:     17:00 17:45 18:30 19:15 20:00 20:45
--   Buchbar:  frühestens 2 Stunden, spätestens 60 Tage im Voraus
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_appointment_slot(p_slot timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_slot >= now() + interval '2 hours'
    and p_slot <= now() + interval '60 days'
    and extract(isodow from local_ts) in (1, 2, 4)
    and extract(second from local_ts) = 0
    and exists (
      select 1
      from (values (time '07:00', time '12:00'),
                   (time '17:00', time '21:00')) as w(win_start, win_end)
      where local_ts::time >= w.win_start
        and local_ts::time <= w.win_end - interval '15 minutes'
        and (extract(epoch from (local_ts::time - w.win_start))::int % (45 * 60)) = 0
    )
  from (select p_slot at time zone 'Europe/Vienna' as local_ts) as l;
$$;

-- Belegte Startzeiten für den Kalender — bewusst ohne Namen/Kontaktdaten.
create or replace function public.get_booked_slots(p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select slot_start
  from public.appointments
  where status <> 'cancelled'
    and slot_start >= p_from
    and slot_start < least(p_to, p_from + interval '90 days')
  order by slot_start;
$$;

-- Termin buchen. Fehler kommen als Klartext-Codes zurück, die termin-booking.js auswertet:
--   INVALID_SLOT, SLOT_TAKEN, TOO_MANY_BOOKINGS
create or replace function public.book_appointment(
  p_slot_start timestamptz,
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_email      text,
  p_offer      text,
  p_message    text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_valid_appointment_slot(p_slot_start) then
    raise exception 'INVALID_SLOT';
  end if;

  -- Einfacher Missbrauchsschutz: max. 2 offene Termine pro E-Mail-Adresse.
  if (select count(*) from public.appointments
      where lower(email) = lower(trim(p_email))
        and status = 'booked'
        and slot_start > now()) >= 2 then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;

  begin
    insert into public.appointments (slot_start, first_name, last_name, phone, email, offer, message)
    values (p_slot_start, trim(p_first_name), trim(p_last_name), trim(p_phone),
            trim(p_email), trim(p_offer), trim(p_message))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return v_id;
end;
$$;

revoke all on function public.is_valid_appointment_slot(timestamptz) from public;
revoke all on function public.get_booked_slots(timestamptz, timestamptz) from public;
revoke all on function public.book_appointment(timestamptz, text, text, text, text, text, text) from public;

grant execute on function public.is_valid_appointment_slot(timestamptz) to anon, authenticated;
grant execute on function public.get_booked_slots(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, text, text) to anon, authenticated;

-- Hinweis: Der Live-Mirror zu RIMA (siehe 20260910130000_mirror_to_rima.sql)
-- hängt nicht automatisch an neuen Tabellen. Soll public.appointments
-- ebenfalls gespiegelt werden, den Trigger dort manuell nachziehen.
