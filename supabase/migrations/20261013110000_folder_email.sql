-- Leistungsfolder: Download gegen E-Mail-Adresse statt Telefonnummer. Idempotent.
alter table public.folder_requests add column if not exists email text;
alter table public.folder_requests alter column phone drop not null;
alter table public.folder_requests drop constraint if exists folder_requests_phone_check;
alter table public.folder_requests drop constraint if exists folder_requests_contact_check;
alter table public.folder_requests add constraint folder_requests_contact_check check (
  (phone is null or (char_length(phone) between 6 and 40 and phone ~ '^[0-9+()/ .\-]+$'))
  and (email is null or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'))
  and (phone is not null or email is not null));
