-- Migration: habit_events (docs/03-datenmodell.md, docs/10-modul-lernen.md).

create table habit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'recipe_kept', 'suggestion_accepted', 'recipe_manual_add',
    'item_unchecked', 'recipe_swapped', 'recipe_rejected'
  )),
  recipe_id uuid references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_habit_events_user_recipe on habit_events(user_id, recipe_id, created_at desc);
create index idx_habit_events_user_ingredient on habit_events(user_id, ingredient_id, created_at desc);

alter table habit_events enable row level security;

create policy habit_events_owner on habit_events for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
