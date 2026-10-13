-- Leistungsfolder (PDF) gegen Telefonnummer. Nach 20261009100000_us_entity.sql ausführen. Idempotent.
-- Das PDF liegt im privaten Storage-Bucket "downloads"; die Edge Function lusides-folder
-- speichert die Anfrage und gibt einen kurz gültigen, signierten Download-Link zurück.

insert into storage.buckets (id, name, public)
values ('downloads', 'downloads', false)
on conflict (id) do update set public = false;

create table if not exists public.folder_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  phone       text not null check (char_length(phone) between 6 and 40 and phone ~ '^[0-9+()/ .\-]+$'),
  lang        text not null default 'de' check (lang in ('de', 'en')),
  page        text check (page is null or char_length(page) <= 200),
  consent_at  timestamptz not null,
  mail_status text not null default 'offen' check (mail_status in ('offen', 'gesendet', 'fehler')),
  status      text not null default 'neu' check (status in ('neu', 'kontaktiert'))
);
create index if not exists folder_requests_created_idx on public.folder_requests (created_at desc);

alter table public.folder_requests enable row level security;
revoke all on public.folder_requests from anon;
grant select, update on public.folder_requests to authenticated;
drop policy if exists "admins read folder_requests" on public.folder_requests;
drop policy if exists "admins update folder_requests" on public.folder_requests;
create policy "admins read folder_requests" on public.folder_requests for select to authenticated using (public.is_admin());
create policy "admins update folder_requests" on public.folder_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
