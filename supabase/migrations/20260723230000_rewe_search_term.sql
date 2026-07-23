-- Bugfix: REWE-Preisabfrage sucht mit ingredients.name gegen die REWE-API
-- (ingest/sources/rewe/fetch.py). Bei kleinerem Filial-Sortiment (market-
-- Filter) matcht REWEs Suche kürzere/andere Begriffe manchmal nicht auf den
-- tatsächlichen Produktnamen (z.B. "Rinderhack" -> Produkt heißt
-- "Rinderhackfleisch"), obwohl das Produkt geführt wird. Statt eines
-- Synonym-Systems: optionales Override-Feld, analog zu pack_size/pack_unit.

alter table ingredients add column rewe_search_term text;

update ingredients set rewe_search_term = 'Rinderhackfleisch' where slug = 'rinderhack';
