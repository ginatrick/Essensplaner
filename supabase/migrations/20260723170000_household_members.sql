-- Migration: household_members (docs/03-datenmodell.md, docs/09-modul-ernaehrung.md).
-- Bewusst OHNE nutrition_targets (auch im Schema dokumentiert) — docs/13-recht-risiken.md
-- untersagt Kalorien-/Nährwert-Vorgaben pro Person in der UI ("Keine Kalorien-
-- Vorgaben pro Kind anzeigen"). Ohne UI, die das je nutzen würde, ist die
-- Tabelle YAGNI; kann bei Bedarf separat nachgezogen werden.

create table household_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  age int,
  activity text not null default 'normal' check (activity in ('normal', 'sport_hoch')),
  training_days int[] not null default '{}'
);

create index idx_household_members_user_id on household_members(user_id);

alter table household_members enable row level security;

create policy household_members_owner on household_members for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
