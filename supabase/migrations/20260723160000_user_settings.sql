-- Migration: Optimizer-Settings (docs/08-modul-rewe-vergleich.md:
-- "TOLERANZ_EUR und SCHWELLE_EUR als Settings -> Patrick stellt selbst ein").
-- Defaults spiegeln web/lib/optimizer/settings.ts DEFAULT_SETTINGS.

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cost_per_km numeric not null default 0.30,
  cost_per_hour numeric not null default 0,
  max_multi_store_count int not null default 3,
  compromise_store_count int not null default 2,
  tolerance_eur numeric not null default 5,
  threshold_eur numeric not null default 5,
  rewe_service_fee_cent int not null default 0,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy user_settings_owner on user_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
