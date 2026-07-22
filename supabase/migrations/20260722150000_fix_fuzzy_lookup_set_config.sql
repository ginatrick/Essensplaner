-- Fix: match_ingredient_alias_fuzzy (Migration 20260722130000) schlägt live
-- fehl mit "SET is not allowed in a non-volatile function" — Postgres
-- verbietet das SQL-Kommando SET (auch SET LOCAL) innerhalb von STABLE-
-- Funktionen. Die Funktion set_config() ist ein regulärer Funktionsaufruf
-- und dort erlaubt; dritter Parameter true = wie SET LOCAL auf die aktuelle
-- Transaktion beschränkt. Ausgerollte Migration nicht ändern, stattdessen
-- per CREATE OR REPLACE korrigieren.

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
  perform set_config('pg_trgm.similarity_threshold', min_similarity::text, true);

  return query
    select ia.ingredient_id, ia.alias, similarity(ia.alias, search) as similarity
    from ingredient_aliases ia
    where ia.alias % search
    order by similarity desc
    limit match_limit;
end;
$$;
