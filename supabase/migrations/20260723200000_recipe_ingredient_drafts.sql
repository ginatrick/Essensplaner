-- Migration: Bugfix — nicht erkannte Zutatenzeilen gingen beim Speichern
-- verloren. recipe_ingredients.ingredient_id ist absichtlich NOT NULL
-- (Aggregation/Optimizer/Ernährungs-Ampel/Vorschlags-Engine verlassen sich
-- darauf, jede Zeile dort ist eine "echte", einkaufbare Zutat). Eine Zeile
-- ohne Treffer landet stattdessen hier als Entwurf, rein zur Anzeige/zum
-- Weiterbearbeiten beim nächsten Öffnen des Rezepts — nimmt an keiner
-- Berechnung teil.

create table recipe_ingredient_drafts (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  raw_name text not null,
  amount text,
  unit text
);

create index idx_recipe_ingredient_drafts_recipe_id on recipe_ingredient_drafts(recipe_id);

alter table recipe_ingredient_drafts enable row level security;

create policy recipe_ingredient_drafts_owner on recipe_ingredient_drafts for all
  to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredient_drafts.recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_ingredient_drafts.recipe_id and r.user_id = auth.uid()));
