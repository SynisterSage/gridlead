create table public.profiles (
  id uuid not null,
  display_name text null,
  agency_name text null,
  monthly_goal integer null,
  gmail_connected boolean null default false,
  onboarding_completed boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trg_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION handle_profiles_updated_at ();