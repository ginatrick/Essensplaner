-- Migration: Planung (meal_plans, meal_plan_entries) inkl. RLS
-- Preise: integer Cent. Mengen: numeric in Basiseinheit (g/ml/stk).

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'final', 'template')),
  source text not null default 'manual' check (source in ('manual', 'suggested'))
);

create index idx_meal_plans_user_id_week_start on meal_plans(user_id, week_start);

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references meal_plans(id) on delete cascade,
  day int not null check (day between 0 and 6),
  slot text not null check (slot in ('mittag', 'abend')),
  recipe_id uuid not null references recipes(id) on delete restrict,
  servings int not null default 4,
  pinned boolean not null default false
);

create index idx_meal_plan_entries_plan_id on meal_plan_entries(plan_id);
create index idx_meal_plan_entries_recipe_id on meal_plan_entries(recipe_id);

-- =========================================================
-- RLS: Nutzertabellen, auth.uid() = user_id (meal_plan_entries via Join auf plan_id)
-- =========================================================

alter table meal_plans enable row level security;
alter table meal_plan_entries enable row level security;

create policy meal_plans_owner on meal_plans for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy meal_plan_entries_owner on meal_plan_entries for all
  to authenticated
  using (exists (select 1 from meal_plans p where p.id = meal_plan_entries.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from meal_plans p where p.id = meal_plan_entries.plan_id and p.user_id = auth.uid()));
