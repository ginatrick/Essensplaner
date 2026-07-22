-- Migration: Titel-Fuzzy-RPC für Duplikaterkennung (docs/05-modul-rezepte.md DoD
-- "Duplikaterkennung per Titel-Fuzzy + Zutaten-Overlap").
-- GIN-Trigram-Index auf recipes.title + RPC match_recipe_titles_fuzzy.
--
-- SECURITY INVOKER (Default, kein SECURITY DEFINER): die Funktion fragt
-- recipes im Kontext des aufrufenden Nutzers ab, die bestehende RLS-Policy
-- recipes_owner (auth.uid() = user_id) filtert automatisch auf dessen eigene
-- Rezepte — keine zusätzliche user_id-Logik in der Funktion nötig.
--
-- Lektion aus Migration 20260722150000: SET/SET LOCAL ist in STABLE-Funktionen
-- verboten ("SET is not allowed in a non-volatile function"). Für den
-- %-Trigram-Operator mit variablem Schwellenwert direkt set_config(...) nutzen.

create index idx_recipes_title_trgm on recipes using gin (title gin_trgm_ops);

create function match_recipe_titles_fuzzy(
  search text,
  min_similarity real default 0.3,
  match_limit int default 5
)
returns table (
  id uuid,
  title text,
  similarity real
)
language plpgsql
stable
as $$
begin
  perform set_config('pg_trgm.similarity_threshold', min_similarity::text, true);

  return query
    select r.id, r.title, similarity(r.title, search) as similarity
    from recipes r
    where r.title % search
    order by similarity desc
    limit match_limit;
end;
$$;

grant execute on function match_recipe_titles_fuzzy(text, real, int) to authenticated;
