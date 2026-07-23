-- Migration: taste_profile, recipe_stats + nightly Aggregation (docs/10-modul-lernen.md).

create table taste_profile (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  score numeric not null default 0,
  n_seen int not null default 0,
  last_seen timestamptz,
  primary key (user_id, ingredient_id)
);

create table recipe_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  times_planned int not null default 0,
  times_swapped_out int not null default 0,
  avg_gap_days numeric,
  last_planned date,
  primary key (user_id, recipe_id)
);

alter table taste_profile enable row level security;
alter table recipe_stats enable row level security;

create policy taste_profile_owner on taste_profile for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recipe_stats_owner on recipe_stats for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- docs/10: score = tanh( Σ(gewicht × decay(alter)) / sqrt(n_seen) ), decay(t) = 0.5 ^ (t_tage/90).
-- Rezept-Events vererben ihr Gewicht anteilig auf jede verwendete Zutat
-- ("funktioniert auch für nie geplante Gerichte") — direkte Zutaten-Events
-- (item_unchecked) zusätzlich zu den über recipe_ingredients aufgelösten.
create or replace function aggregate_habit_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with weighted_events as (
    select
      he.user_id,
      coalesce(he.ingredient_id, ri.ingredient_id) as ingredient_id,
      case he.event_type
        when 'recipe_kept' then 1.0
        when 'suggestion_accepted' then 0.8
        when 'recipe_manual_add' then 0.5
        when 'item_unchecked' then -0.2
        when 'recipe_swapped' then -0.6
        when 'recipe_rejected' then -1.0
      end as weight,
      power(0.5, (extract(epoch from (now() - he.created_at)) / 86400.0) / 90.0) as decay
    from habit_events he
    left join recipe_ingredients ri on he.recipe_id is not null and ri.recipe_id = he.recipe_id
    where he.ingredient_id is not null or he.recipe_id is not null
  ),
  aggregated as (
    select user_id, ingredient_id, sum(weight * decay) as weighted_sum, count(*) as n_seen
    from weighted_events
    where ingredient_id is not null
    group by user_id, ingredient_id
  )
  insert into taste_profile (user_id, ingredient_id, score, n_seen, last_seen)
  select user_id, ingredient_id, tanh(weighted_sum / sqrt(n_seen)), n_seen, now()
  from aggregated
  on conflict (user_id, ingredient_id) do update
    set score = excluded.score, n_seen = excluded.n_seen, last_seen = excluded.last_seen;

  -- recipe_stats aus der tatsächlichen Planungshistorie (meal_plans/meal_plan_entries),
  -- zuverlässiger für "wie oft/wann geplant" als aus habit_events herzuleiten.
  with plannings as (
    select mp.user_id, mpe.recipe_id, mp.week_start,
      lag(mp.week_start) over (partition by mp.user_id, mpe.recipe_id order by mp.week_start) as prev_week_start
    from meal_plan_entries mpe
    join meal_plans mp on mp.id = mpe.plan_id
    where mp.status in ('draft', 'final')
  ),
  planning_stats as (
    select user_id, recipe_id, count(*) as times_planned, max(week_start) as last_planned,
      avg(extract(epoch from (week_start - prev_week_start)) / 86400.0) filter (where prev_week_start is not null) as avg_gap_days
    from plannings
    group by user_id, recipe_id
  ),
  swap_stats as (
    select user_id, recipe_id, count(*) as times_swapped_out
    from habit_events
    where event_type = 'recipe_swapped' and recipe_id is not null
    group by user_id, recipe_id
  )
  insert into recipe_stats (user_id, recipe_id, times_planned, times_swapped_out, avg_gap_days, last_planned)
  select
    coalesce(p.user_id, s.user_id), coalesce(p.recipe_id, s.recipe_id),
    coalesce(p.times_planned, 0), coalesce(s.times_swapped_out, 0), p.avg_gap_days, p.last_planned
  from planning_stats p
  full outer join swap_stats s on p.user_id = s.user_id and p.recipe_id = s.recipe_id
  on conflict (user_id, recipe_id) do update
    set times_planned = excluded.times_planned, times_swapped_out = excluded.times_swapped_out,
        avg_gap_days = excluded.avg_gap_days, last_planned = excluded.last_planned;
end;
$$;

grant execute on function aggregate_habit_scores() to service_role;

-- Nightly Cron. pg_cron muss im Supabase-Projekt aktiviert sein (Dashboard:
-- Database -> Extensions -> pg_cron). Schlägt dieser Teil fehl, weil die
-- Extension noch nicht aktiv ist: Extension im Dashboard aktivieren, dann
-- nur den select-cron.schedule-Befehl unten manuell nachholen.
create extension if not exists pg_cron;
select cron.schedule('nightly-aggregate-habit-scores', '0 3 * * *', $$select aggregate_habit_scores()$$);
