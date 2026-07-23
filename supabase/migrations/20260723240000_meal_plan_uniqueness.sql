-- Bugfix: "Schon in den letzten 14 Tagen" erschien bei Gerichten, die nie
-- zuvor geplant waren. Die Regel war korrekt — die Daten nicht: es gab
-- mehrere Wochenpläne für dieselbe Woche und darin jedes Gericht doppelt.
-- Die Tabellen hatten keinerlei Unique-Constraints, ein doppelter Klick auf
-- "Vorschlag übernehmen" oder ein paralleler Seitenaufruf legte alles erneut an.

-- 1. Doppelte Einträge je (plan_id, day, slot) entfernen, ältesten behalten.
delete from meal_plan_entries a
using meal_plan_entries b
where a.plan_id = b.plan_id
  and a.day = b.day
  and a.slot = b.slot
  and a.ctid > b.ctid;

-- 2. Mehrfache Pläne derselben Woche zusammenführen: der Plan mit den meisten
-- Einträgen gewinnt, die übrigen werden gelöscht (Einträge per Cascade).
-- Bewusst kein Merge der Einträge — bei belegtem (day, slot) gäbe es sonst
-- einen Konflikt, den nur der Nutzer entscheiden kann.
with ranked as (
  select p.id,
         row_number() over (
           partition by p.user_id, p.week_start
           order by (select count(*) from meal_plan_entries e where e.plan_id = p.id) desc, p.id
         ) as rn
  from meal_plans p
  where p.status <> 'template'
)
delete from meal_plans where id in (select id from ranked where rn > 1);

-- 3. Wiederholung ausschließen. Templates sind ausgenommen: davon darf es pro
-- Woche beliebig viele geben (sie nutzen week_start nur als Ablagefeld).
create unique index uq_meal_plans_user_week
  on meal_plans(user_id, week_start)
  where status <> 'template';

create unique index uq_meal_plan_entries_plan_day_slot
  on meal_plan_entries(plan_id, day, slot);
