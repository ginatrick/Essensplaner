-- Migration: RPC zum Anlegen neuer Zutaten durch den Nutzer (Bugfix-Folge:
-- nicht erkannte Rezept-Zutaten sollen entweder einer bestehenden Zutat
-- zugeordnet oder als neue Zutat angelegt werden können). ingredients ist
-- laut docs/02-architektur.md eine globale Tabelle, Schreiben nur
-- service_role — dieselbe SECURITY-DEFINER-Brücke wie insert_ingredient_alias
-- (Migration 20260722140000) und resolve_offer_match (20260723130000).

-- Slug-Konvention aus codex/001-seed-ingredients.md: lowercase, deutsche
-- Umlaute transliteriert (ä→ae, ö→oe, ü→ue, ß→ss).
create or replace function slugify_de(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(replace(replace(replace(replace(input, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function insert_ingredient(
  p_name text,
  p_base_unit text,
  p_department_id int default null,
  p_pack_size numeric default null,
  p_pack_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'name darf nicht leer sein';
  end if;
  if p_base_unit not in ('g', 'ml', 'stk') then
    raise exception 'ungültige base_unit: %', p_base_unit;
  end if;

  v_slug := slugify_de(p_name);

  -- on conflict: existiert die Zutat (gleicher Slug) schon, deren id zurückgeben
  -- statt zu fehlern — verhindert Duplikate, falls die Fuzzy-Suche zuvor einen
  -- exakten Treffer übersehen hat.
  insert into ingredients (name, slug, base_unit, department_id, pack_size, pack_unit)
  values (btrim(p_name), v_slug, p_base_unit, p_department_id, p_pack_size, p_pack_unit)
  on conflict (slug) do update set name = ingredients.name
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function insert_ingredient(text, text, int, numeric, text) to authenticated;
