-- Besucher-Statistik und Live-Tracker. Nach 20261006100000_language_currency.sql ausführen. Idempotent.
--
-- Erfasst pseudonym (keine IP, keine Formularinhalte, keine Cookies; Sitzungs-ID nur im
-- sessionStorage des Browsers): Seitenaufrufe, Klicks, Scrolltiefe, Verweildauer,
-- begonnene/abgeschickte Formulare und Conversions. Schreiben nur über public.track(),
-- lesen nur für Admins (public.is_admin()).

-- ---------- Tabellen ----------
create table if not exists public.visitor_sessions (
  session_id  uuid primary key,
  started_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  entry_page  text,
  page        text,              -- aktuelle bzw. letzte Seite (= Ausstiegsseite)
  section     text,              -- aktueller Abschnitt auf der Seite
  scroll      int,               -- aktuelle Scrolltiefe in %
  lang        text,
  device      text,
  source      text,              -- Herkunft (Suchmaschine, Website, utm_source, direkt)
  pages       int not null default 0,
  events      int not null default 0,
  converted   boolean not null default false
);
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions (last_seen desc);
create index if not exists visitor_sessions_started_idx on public.visitor_sessions (started_at desc);

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  uuid not null,
  type        text not null check (type in ('pageview','click','form_start','form_submit','conversion','leave')),
  page        text not null,
  label       text,              -- Klickziel, Formular oder Conversion-Art
  href        text,              -- Linkziel bei Klicks
  section     text,              -- Abschnitt, in dem das Ereignis stattfand
  seconds     int,               -- Verweildauer auf der Seite (bei 'leave')
  scroll      int                -- maximale Scrolltiefe in % (bei 'leave')
);
create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_session_idx on public.site_events (session_id, created_at);

alter table public.visitor_sessions enable row level security;
alter table public.site_events      enable row level security;
revoke all on public.visitor_sessions from anon, authenticated;
revoke all on public.site_events      from anon, authenticated;
grant select on public.visitor_sessions to authenticated;
grant select on public.site_events      to authenticated;
drop policy if exists "admins read visitor_sessions" on public.visitor_sessions;
create policy "admins read visitor_sessions" on public.visitor_sessions for select to authenticated using (public.is_admin());
drop policy if exists "admins read site_events" on public.site_events;
create policy "admins read site_events" on public.site_events for select to authenticated using (public.is_admin());

-- ---------- Schreiben (öffentlich, aber geprüft und gedrosselt) ----------
-- p = { s: session-uuid, page, section, scroll, lang, device, source, e: [ {t, page, label, href, section, seconds, scroll}, … ] }
create or replace function public.track(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sid uuid;
  v_page text := left(coalesce(p->>'page', ''), 200);
  v_events jsonb := coalesce(p->'e', '[]'::jsonb);
  v_n int; v_pv int; v_conv boolean; v_count int;
  clip_int constant text := '^-?[0-9]{1,7}$';
begin
  if jsonb_typeof(p) <> 'object' or coalesce(p->>'s', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_page !~ '^/' or jsonb_typeof(v_events) <> 'array' then
    return;
  end if;
  v_sid := (p->>'s')::uuid;
  if jsonb_array_length(v_events) > 50 then v_events := '[]'::jsonb; end if;

  -- Drosselung: max. 3000 Ereignisse je Sitzung, max. 60 000 Aufrufe pro Stunde gesamt
  select events into v_count from public.visitor_sessions where session_id = v_sid;
  if coalesce(v_count, 0) > 3000 then return; end if;
  if not public.hit_rate_limit('track', 60000, interval '1 hour') then return; end if;

  insert into public.site_events (session_id, type, page, label, href, section, seconds, scroll)
  select v_sid, e->>'t', left(coalesce(nullif(e->>'page', ''), v_page), 200),
         nullif(left(e->>'label', 160), ''), nullif(left(e->>'href', 300), ''), nullif(left(e->>'section', 80), ''),
         case when coalesce(e->>'seconds', '') ~ clip_int then least(greatest((e->>'seconds')::int, 0), 86400) end,
         case when coalesce(e->>'scroll', '') ~ clip_int then least(greatest((e->>'scroll')::int, 0), 100) end
  from jsonb_array_elements(v_events) e
  where jsonb_typeof(e) = 'object'
    and e->>'t' in ('pageview','click','form_start','form_submit','conversion','leave')
    and coalesce(nullif(e->>'page', ''), v_page) ~ '^/';
  get diagnostics v_n = row_count;

  select count(*) filter (where e->>'t' = 'pageview'), bool_or(e->>'t' = 'conversion')
    into v_pv, v_conv from jsonb_array_elements(v_events) e where jsonb_typeof(e) = 'object';

  insert into public.visitor_sessions as vs (session_id, entry_page, page, section, scroll, lang, device, source, pages, events, converted)
  values (v_sid, v_page, v_page, nullif(left(p->>'section', 80), ''),
          case when coalesce(p->>'scroll', '') ~ clip_int then least(greatest((p->>'scroll')::int, 0), 100) end,
          nullif(left(p->>'lang', 5), ''), nullif(left(p->>'device', 20), ''), nullif(left(p->>'source', 120), ''),
          coalesce(v_pv, 0), v_n, coalesce(v_conv, false))
  on conflict (session_id) do update set
    last_seen = now(),
    page      = excluded.page,
    section   = excluded.section,
    scroll    = excluded.scroll,
    lang      = coalesce(excluded.lang, vs.lang),
    pages     = vs.pages + excluded.pages,
    events    = vs.events + excluded.events,
    converted = vs.converted or excluded.converted;

  -- Aufräumen: Rohdaten nach 13 Monaten löschen
  if random() < 0.002 then
    delete from public.site_events where created_at < now() - interval '400 days';
    delete from public.visitor_sessions where last_seen < now() - interval '400 days';
  end if;
end $$;
revoke all on function public.track(jsonb) from public;
grant execute on function public.track(jsonb) to anon, authenticated;

-- ---------- Lesen (nur Admins) ----------
-- Statistik für einen Zeitraum
create or replace function public.analytics_overview(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  with
  s as (select * from public.visitor_sessions where started_at >= p_from and started_at < p_to),
  ev as (select e.* from public.site_events e join s using (session_id)),
  pv as (select page, count(*) views, count(distinct session_id) sessions from ev where type = 'pageview' group by page),
  -- je Sitzung und Seite: gesamte sichtbare Zeit und tiefste Scrollposition
  lsp as (select page, session_id, sum(seconds) secs, max(scroll) sc from ev where type = 'leave' group by page, session_id),
  lv as (select page, round(avg(secs)) avg_seconds, round(avg(sc)) avg_scroll,
                round(100.0 * count(*) filter (where sc >= 25) / nullif(count(*), 0)) r25,
                round(100.0 * count(*) filter (where sc >= 50) / nullif(count(*), 0)) r50,
                round(100.0 * count(*) filter (where sc >= 75) / nullif(count(*), 0)) r75,
                round(100.0 * count(*) filter (where sc >= 95) / nullif(count(*), 0)) r100
         from lsp group by page),
  ex as (select page, count(*) exits from s group by page),
  exs as (select page, section, count(*) n from s where section is not null group by page, section),
  steps as (
    select session_id,
           bool_or(true) visited,
           bool_or(type = 'pageview' and page like '%/termin.html') termin,
           bool_or(type = 'form_start' and page like '%/termin.html') termin_form,
           bool_or(type = 'conversion' and label = 'appointment_booked') booked,
           bool_or(type = 'form_start' and page not like '%/termin.html') contact_form,
           bool_or(type = 'conversion' and label = 'form_submit') contact_sent,
           bool_or(type = 'conversion' and label = 'project_sheet') sheet_sent
    from ev group by session_id)
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'sessions', count(*),
        'pageviews', coalesce(sum(pages), 0),
        'avg_seconds', coalesce(round(avg(extract(epoch from last_seen - started_at))), 0),
        'bounce', coalesce(round(100.0 * count(*) filter (where pages <= 1) / nullif(count(*), 0)), 0),
        'converted', count(*) filter (where converted),
        'clicks', (select count(*) from ev where type = 'click')) from s),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'sessions', n, 'pageviews', pvs) order by d)
        from (select (started_at at time zone 'Europe/Vienna')::date d, count(*) n, sum(pages) pvs from s group by 1) x), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('page', pv.page, 'views', pv.views, 'sessions', pv.sessions,
        'avg_seconds', lv.avg_seconds, 'avg_scroll', lv.avg_scroll, 'r25', lv.r25, 'r50', lv.r50, 'r75', lv.r75, 'r100', lv.r100,
        'exits', coalesce(ex.exits, 0), 'exit_rate', round(100.0 * coalesce(ex.exits, 0) / nullif(pv.sessions, 0))) order by pv.views desc)
        from pv left join lv using (page) left join ex using (page)), '[]'),
    'exit_sections', coalesce((select jsonb_agg(jsonb_build_object('page', page, 'section', section, 'n', n) order by n desc)
        from (select * from exs order by n desc limit 25) x), '[]'),
    'clicks', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'page', page, 'href', href, 'n', n) order by n desc)
        from (select label, page, max(href) href, count(*) n from ev where type = 'click' and label is not null
              group by label, page order by n desc limit 40) x), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', src, 'n', n) order by n desc)
        from (select coalesce(source, 'Direkt') src, count(*) n from s group by 1 order by 2 desc limit 15) x), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', coalesce(device, '?'), 'n', n) order by n desc)
        from (select device, count(*) n from s group by 1) x), '[]'),
    'langs', coalesce((select jsonb_agg(jsonb_build_object('lang', coalesce(lang, '?'), 'n', n) order by n desc)
        from (select lang, count(*) n from s group by 1) x), '[]'),
    'funnel_booking', (select jsonb_build_array(
        jsonb_build_object('step', 'Besuch', 'n', count(*)),
        jsonb_build_object('step', 'Terminseite geöffnet', 'n', count(*) filter (where termin)),
        jsonb_build_object('step', 'Buchungsformular begonnen', 'n', count(*) filter (where termin_form)),
        jsonb_build_object('step', 'Termin gebucht', 'n', count(*) filter (where booked))) from steps),
    'funnel_contact', (select jsonb_build_array(
        jsonb_build_object('step', 'Besuch', 'n', count(*)),
        jsonb_build_object('step', 'Formular begonnen', 'n', count(*) filter (where contact_form)),
        jsonb_build_object('step', 'Anfrage gesendet', 'n', count(*) filter (where contact_sent)),
        jsonb_build_object('step', 'Projektdatenblatt gesendet', 'n', count(*) filter (where sheet_sent))) from steps)
  ) into r;
  return r;
end $$;

-- Letzte Sitzungen (für die Liste mit Klickpfad)
create or replace function public.analytics_sessions(p_from timestamptz, p_to timestamptz, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (
    select session_id, started_at, last_seen, entry_page, page, section, scroll, lang, device, source, pages, events, converted
    from public.visitor_sessions where started_at >= p_from and started_at < p_to
    order by started_at desc limit least(greatest(p_limit, 1), 500)) x), '[]');
end $$;

-- Alle Ereignisse einer Sitzung (Klickpfad)
create or replace function public.analytics_session(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', created_at, 'type', type, 'page', page, 'label', label, 'href', href,
      'section', section, 'seconds', seconds, 'scroll', scroll) order by id)
    from public.site_events where session_id = p_session), '[]');
end $$;

-- Wer ist gerade auf der Seite? (aktiv in den letzten 45 Sekunden) + die letzten Schritte
create or replace function public.analytics_live()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'now', now(),
    'active', coalesce((select jsonb_agg(jsonb_build_object(
        'session_id', vs.session_id, 'started_at', vs.started_at, 'last_seen', vs.last_seen, 'page', vs.page, 'section', vs.section,
        'scroll', vs.scroll, 'lang', vs.lang, 'device', vs.device, 'source', vs.source, 'pages', vs.pages, 'converted', vs.converted,
        'trail', (select coalesce(jsonb_agg(t order by t->>'at'), '[]') from (
            select jsonb_build_object('at', e.created_at, 'type', e.type, 'page', e.page, 'label', e.label, 'section', e.section) t
            from public.site_events e where e.session_id = vs.session_id and e.type in ('pageview','click','form_start','form_submit','conversion')
            order by e.id desc limit 12) tr)
      ) order by vs.started_at desc)
      from public.visitor_sessions vs where vs.last_seen > now() - interval '45 seconds'), '[]'),
    'last_hour', (select count(*) from public.visitor_sessions where last_seen > now() - interval '1 hour'),
    'today', (select count(*) from public.visitor_sessions where started_at >= (date_trunc('day', now() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna'))
  );
end $$;

revoke all on function public.analytics_overview(timestamptz, timestamptz) from public, anon;
revoke all on function public.analytics_sessions(timestamptz, timestamptz, int) from public, anon;
revoke all on function public.analytics_session(uuid) from public, anon;
revoke all on function public.analytics_live() from public, anon;
grant execute on function public.analytics_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_sessions(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.analytics_session(uuid) to authenticated;
grant execute on function public.analytics_live() to authenticated;
