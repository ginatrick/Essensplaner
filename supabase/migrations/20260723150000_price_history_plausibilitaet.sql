-- Migration: price_history + Plausibilitätsfilter (docs/06-modul-angebote.md).
-- Preise: integer Cent.

create table price_history (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  store_id uuid not null references stores(id) on delete cascade,
  price_cent int not null,
  observed_at timestamptz not null default now()
);

create index idx_price_history_ingredient_store on price_history(ingredient_id, store_id, observed_at desc);

alter table price_history enable row level security;

create policy price_history_select on price_history for select to authenticated using (true);
create policy price_history_write on price_history for all to service_role using (true) with check (true);

-- docs/06: "Ein Angebot zählt nur als Ersparnis wenn price_cent < median(price_history, 90 Tage) × 0.9".
-- Mit < 3 Preispunkten in den letzten 90 Tagen ist ein Median nicht aussagekräftig
-- (z. B. beim allerersten beobachteten Preis) — dann gilt das Angebot als plausibel,
-- statt jedes neue Angebot mangels Historie fälschlich als "Schein-Angebot" abzulehnen.
create or replace function is_plausible_offer(
  p_ingredient_id uuid,
  p_store_id uuid,
  p_price_cent int
)
returns boolean
language plpgsql
stable
as $$
declare
  v_count int;
  v_median numeric;
begin
  select count(*), percentile_cont(0.5) within group (order by price_cent)
  into v_count, v_median
  from price_history
  where ingredient_id = p_ingredient_id
    and store_id = p_store_id
    and observed_at > now() - interval '90 days';

  if v_count < 3 then
    return true;
  end if;

  return p_price_cent < v_median * 0.9;
end;
$$;

grant execute on function is_plausible_offer(uuid, uuid, int) to authenticated;
