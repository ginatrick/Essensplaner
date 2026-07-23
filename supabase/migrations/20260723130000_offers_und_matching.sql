-- Migration: offers-Tabelle + Review-RPC für Angebots-Matching (Phase 4).
-- Preise: integer Cent. Mengen: numeric in Roh-Einheit (unit ist der
-- Prospekt-Rohtext, siehe RawOffer in ingest/sources/_types.py — anders als
-- recipe_ingredients hier bewusst NICHT auf g/ml/stk vorab normalisiert,
-- weil die Rohtexte pro Kette zu uneinheitlich sind, siehe
-- codex/007-prospekt-aldi-norma.md).

create table offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  ingredient_id uuid references ingredients(id),
  raw_title text not null,
  brand text,
  amount numeric,
  unit text,
  price_cent int not null,
  base_price_cent int,
  valid_from date,
  valid_to date,
  source text not null,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_offers_store_valid on offers(store_id, valid_from, valid_to);
create index idx_offers_ingredient_id on offers(ingredient_id);
-- Review-Queue-Abfrage (docs/06: confidence < 0.7 → Review, nicht in den Optimizer).
create index idx_offers_low_confidence on offers(confidence) where confidence < 0.7;

alter table offers enable row level security;

create policy offers_select on offers for select to authenticated using (true);
create policy offers_write on offers for all to service_role using (true) with check (true);

-- Review-UI schreibt als authenticated, nicht service_role — dieselbe
-- SECURITY-DEFINER-Brücke wie insert_ingredient_alias (Migration
-- 20260722140000). Setzt Confidence auf 1 (menschlich bestätigt) und lernt
-- gleichzeitig den Alias für zukünftige automatische Treffer.
create or replace function resolve_offer_match(
  p_offer_id uuid,
  p_ingredient_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_title text;
begin
  if not exists (select 1 from ingredients where id = p_ingredient_id) then
    raise exception 'ingredient_id % existiert nicht', p_ingredient_id;
  end if;

  select raw_title into v_raw_title from offers where id = p_offer_id;
  if v_raw_title is null then
    raise exception 'offer % existiert nicht', p_offer_id;
  end if;

  update offers set ingredient_id = p_ingredient_id, confidence = 1
  where id = p_offer_id;

  insert into ingredient_aliases (ingredient_id, alias, source, confidence)
  values (p_ingredient_id, btrim(v_raw_title), 'offer', 1)
  on conflict (lower(alias)) do nothing;
end;
$$;

grant execute on function resolve_offer_match(uuid, uuid) to authenticated;
