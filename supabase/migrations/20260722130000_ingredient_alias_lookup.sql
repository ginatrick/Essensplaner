-- Migration: RPC für Trigram-Fuzzy-Lookup auf ingredient_aliases.
-- Exakter Treffer läuft direkt über supabase-js (.ilike ohne Wildcards).
-- Diese Funktion deckt Stufe 2b (Fuzzy) aus docs/05-modul-rezepte.md ab.

-- language sql mit similarity(a,b) >= x im WHERE nutzt den GIN-Trgm-Index NICHT
-- (Sequential Scan). Der %-Operator wird vom Index unterstützt, sein
-- Schwellenwert kommt aber aus der Session-GUC pg_trgm.similarity_threshold —
-- daher plpgsql mit SET LOCAL, scoped auf diesen Funktionsaufruf.
create or replace function match_ingredient_alias_fuzzy(
  search text,
  min_similarity real default 0.4,
  match_limit int default 1
)
returns table (
  ingredient_id uuid,
  alias text,
  similarity real
)
language plpgsql
stable
as $$
begin
  set local pg_trgm.similarity_threshold = min_similarity;

  return query
    select ia.ingredient_id, ia.alias, similarity(ia.alias, search) as similarity
    from ingredient_aliases ia
    where ia.alias % search
    order by similarity desc
    limit match_limit;
end;
$$;

grant execute on function match_ingredient_alias_fuzzy(text, real, int) to authenticated;
