-- Adds an optional organization name to NDA acceptance records.

alter table public.pitch_nda_acceptances add column organization text;
