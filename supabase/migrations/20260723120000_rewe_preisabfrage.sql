-- Migration: REWE-Preisabfrage vorbereiten (Phase 4).
-- rewe_market_id = "wwIdent" aus der REWE-Shop-API (shop.rewe.de/api/products,
-- Param "market"), nicht identisch mit unserer stores.id. Siehe
-- codex/005-rewe-preisabfrage.md für den vollen API-Kontrakt.

alter table stores add column rewe_market_id text;

-- REWE Schmalkalden (Renthofstr. 8) — bestätigt Abholservice-fähig (serviceTypes=PICKUP
-- liefert Treffer). REWE Center Zella-Mehlis (Industriestr. 4-6) ist der eigentliche
-- Abholmarkt des Nutzers, aktuell wegen Umbau geschlossen (0 Treffer bei Testabfrage) —
-- ID trotzdem hinterlegt, damit es nach Wiedereröffnung ohne Schema-Änderung läuft.
update stores set rewe_market_id = '1469536'
  where chain = 'REWE' and name like 'REWE Schmalkalden (Renthofstraße 8)%';
update stores set rewe_market_id = '4031020'
  where chain = 'REWE' and name like 'REWE Zella-Mehlis%';

-- rewe_prices — Cache für REWE-Preistreffer, siehe docs/03-datenmodell.md.
-- price_cent bezieht sich auf (amount, unit): bei Gewicht/Volumen-Artikeln ist das
-- REWEs eigener Grundpreis (amount=1000, unit='g'|'ml', price_cent=Cent pro 1000
-- Basiseinheiten — ganzzahlig, kein Runden auf Bruchteile eines Gramms nötig),
-- bei Stückware amount=1, unit='stk', price_cent=Preis pro Stück.
create table rewe_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  product_name text not null,
  amount numeric not null,
  unit text not null check (unit in ('g', 'ml', 'stk')),
  price_cent int not null,
  is_offer boolean not null default false,
  market_id text not null,
  fetched_at timestamptz not null default now()
);

create index idx_rewe_prices_ingredient_market on rewe_prices(ingredient_id, market_id, fetched_at desc);

alter table rewe_prices enable row level security;

create policy rewe_prices_select on rewe_prices for select to authenticated using (true);
create policy rewe_prices_write on rewe_prices for all to service_role using (true) with check (true);
