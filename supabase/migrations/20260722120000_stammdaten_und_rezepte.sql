-- Migration 001: Stammdaten (departments, ingredients, ingredient_aliases, stores)
-- + Rezepte (recipes, recipe_ingredients, recipe_steps) inkl. RLS
-- Preise: integer Cent. Mengen: numeric in Basiseinheit (g/ml/stk).

create extension if not exists pg_trgm;

-- =========================================================
-- Stammdaten
-- =========================================================

create table departments (
  id serial primary key,
  name text not null unique,
  sort_order int not null unique
);

insert into departments (name, sort_order) values
  ('Obst & Gemüse', 1),
  ('Backwaren', 2),
  ('Fleisch/Wurst', 3),
  ('Käse/Theke', 4),
  ('Kühlregal', 5),
  ('Tiefkühl', 6),
  ('Trockensortiment', 7),
  ('Konserven', 8),
  ('Getränke', 9),
  ('Drogerie', 10);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  base_unit text not null check (base_unit in ('g', 'ml', 'stk')),
  department_id int references departments(id),
  density_g_ml numeric,
  kcal_100 numeric,
  protein_100 numeric,
  carbs_100 numeric,
  fat_100 numeric,
  fiber_100 numeric,
  iron_mg_100 numeric,
  calcium_mg_100 numeric,
  season_months int[],
  tags text[]
);

create index idx_ingredients_department_id on ingredients(department_id);

create table ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  alias text not null,
  source text not null check (source in ('recipe', 'offer', 'rewe')),
  confidence numeric
);

create index idx_ingredient_aliases_ingredient_id on ingredient_aliases(ingredient_id);
create index idx_ingredient_aliases_alias_trgm on ingredient_aliases using gin (alias gin_trgm_ops);

create table stores (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  name text not null,
  lat numeric,
  lng numeric,
  address text,
  distance_km numeric,
  drive_min numeric,
  department_layout jsonb
);

-- =========================================================
-- Rezepte
-- =========================================================

create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_url text,
  servings_base int not null default 4,
  prep_min int,
  cook_min int,
  difficulty text check (difficulty in ('einfach', 'mittel', 'schwer')),
  tags text[],
  kid_friendly boolean not null default false,
  is_experimental boolean not null default false,
  image_path text
);

create index idx_recipes_user_id on recipes(user_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  amount numeric not null,
  unit text not null,
  note text,
  is_optional boolean not null default false
);

create index idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_ingredient_id on recipe_ingredients(ingredient_id);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step_no int not null,
  text text not null,
  unique (recipe_id, step_no)
);

create index idx_recipe_steps_recipe_id on recipe_steps(recipe_id);

-- =========================================================
-- RLS: globale Stammdaten — SELECT für authenticated, Schreiben nur service_role
-- =========================================================

alter table departments enable row level security;
alter table ingredients enable row level security;
alter table ingredient_aliases enable row level security;
alter table stores enable row level security;

create policy departments_select on departments for select to authenticated using (true);
create policy departments_write on departments for all to service_role using (true) with check (true);

create policy ingredients_select on ingredients for select to authenticated using (true);
create policy ingredients_write on ingredients for all to service_role using (true) with check (true);

create policy ingredient_aliases_select on ingredient_aliases for select to authenticated using (true);
create policy ingredient_aliases_write on ingredient_aliases for all to service_role using (true) with check (true);

create policy stores_select on stores for select to authenticated using (true);
create policy stores_write on stores for all to service_role using (true) with check (true);

-- =========================================================
-- RLS: Rezepte — Nutzertabellen, auth.uid() = user_id
-- =========================================================

alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;

create policy recipes_owner on recipes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy recipe_ingredients_owner on recipe_ingredients for all
  to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()));

create policy recipe_steps_owner on recipe_steps for all
  to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()));
