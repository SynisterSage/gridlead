-- Add checklist booleans for audits
alter table if exists public.leads
  add column if not exists checklist_mobile_optimization boolean,
  add column if not exists checklist_ssl_certificate boolean,
  add column if not exists checklist_seo_presence boolean,
  add column if not exists checklist_conversion_flow boolean,
  add column if not exists checklist_google_reviews boolean,
  add column if not exists checklist_render boolean;
