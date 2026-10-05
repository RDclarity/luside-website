-- Online-Widerrufsfunktion „Vertrag widerrufen" (§ 13a FAGG). Nach 20261008100000_price_30min.sql ausführen. Idempotent.
-- Einträge schreibt nur die Edge Function lusides-withdraw (Service-Role); Admins lesen und bearbeiten.

create table if not exists public.withdrawals (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 2 and 120),
  email          text not null check (char_length(email) <= 254),
  order_no       text check (order_no is null or char_length(order_no) <= 40),
  message        text check (message is null or char_length(message) <= 2000),
  lang           text not null default 'de' check (lang in ('de', 'en')),
  appointment_id uuid references public.appointments(id) on delete set null,
  mail_status    text not null default 'offen' check (mail_status in ('offen', 'gesendet', 'fehler')),
  status         text not null default 'eingegangen' check (status in ('eingegangen', 'bearbeitet')),
  note           text
);
create index if not exists withdrawals_created_idx on public.withdrawals (created_at desc);

alter table public.withdrawals enable row level security;
revoke all on public.withdrawals from anon;
grant select, update on public.withdrawals to authenticated;
drop policy if exists "admins read withdrawals" on public.withdrawals;
drop policy if exists "admins update withdrawals" on public.withdrawals;
create policy "admins read withdrawals" on public.withdrawals for select to authenticated using (public.is_admin());
create policy "admins update withdrawals" on public.withdrawals for update to authenticated using (public.is_admin()) with check (public.is_admin());
