-- Migration: Pantry (Vorräte) + Packungsgröße an ingredients, für Einkaufsliste Phase 3
-- Preise: integer Cent. Mengen: numeric in Basiseinheit (g/ml/stk).

alter table ingredients add column pack_size numeric;
alter table ingredients add column pack_unit text check (pack_unit in ('g', 'ml', 'stk'));

create table pantry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  amount numeric not null,
  unit text not null check (unit in ('g', 'ml', 'stk')),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id)
);

create index idx_pantry_user_id on pantry(user_id);

alter table pantry enable row level security;

create policy pantry_owner on pantry for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
