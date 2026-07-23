-- Migration: Abhaken auf der Einkaufsliste. Die Liste selbst wird weiter live aus
-- meal_plan_entries/recipe_ingredients aggregiert (siehe web/lib/plan/aggregate.ts) —
-- diese Tabelle hält nur den Checked-Status pro (Plan, Zutat).

create table shopping_checked (
  plan_id uuid not null references meal_plans(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  checked boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan_id, ingredient_id)
);

alter table shopping_checked enable row level security;

create policy shopping_checked_owner on shopping_checked for all
  to authenticated
  using (exists (select 1 from meal_plans p where p.id = shopping_checked.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from meal_plans p where p.id = shopping_checked.plan_id and p.user_id = auth.uid()));
