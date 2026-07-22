-- Migration: RPC für Alias-Rückschreibung (docs/05-modul-rezepte.md Schritt 3
-- "Miss → Claude Haiku klassifiziert → schreibt Alias zurück").
-- ingredient_aliases erlaubt laut RLS (Migration 001) nur service_role zum
-- Schreiben. Diese SECURITY DEFINER-Funktion ist der kontrollierte
-- Schreibpfad für authenticated (validiert source/alias/ingredient_id statt
-- RLS pauschal zu öffnen).

-- Idempotenz-Basis: wiederholte Haiku-Treffer für denselben Text dürfen nicht
-- doppelt landen.
create unique index ingredient_aliases_alias_lower_idx on ingredient_aliases (lower(alias));

create or replace function insert_ingredient_alias(
  p_ingredient_id uuid,
  p_alias text,
  p_source text default 'recipe',
  p_confidence numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source not in ('recipe', 'offer', 'rewe') then
    raise exception 'Ungültige source: %', p_source;
  end if;

  if p_alias is null or btrim(p_alias) = '' then
    raise exception 'alias darf nicht leer sein';
  end if;

  if not exists (select 1 from ingredients where id = p_ingredient_id) then
    raise exception 'ingredient_id % existiert nicht', p_ingredient_id;
  end if;

  insert into ingredient_aliases (ingredient_id, alias, source, confidence)
  values (p_ingredient_id, btrim(p_alias), p_source, p_confidence)
  on conflict (lower(alias)) do nothing;
end;
$$;

grant execute on function insert_ingredient_alias(uuid, text, text, numeric) to authenticated;
