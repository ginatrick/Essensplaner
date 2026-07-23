# 03 — Datenmodell

Preise: `integer` in **Cent**. Mengen: `numeric` in **Basiseinheit** (g/ml/stk).

## Stammdaten
**ingredients** — kanonische Zutaten
`id · name · slug(uniq) · base_unit · department_id · density_g_ml · kcal_100 · protein_100 · carbs_100 · fat_100 · fiber_100 · iron_mg_100 · calcium_mg_100 · season_months int[] · tags text[] · pack_size numeric(nullable) · pack_unit(nullable)`

**ingredient_aliases** — Synonym-Mapping für Parser
`id · ingredient_id · alias · source('recipe'|'offer'|'rewe') · confidence`

**departments** — Abteilungen, `sort_order` = Laufrichtung im Markt
`Obst & Gemüse · Backwaren · Fleisch/Wurst · Käse/Theke · Kühlregal · Tiefkühl · Trockensortiment · Konserven · Getränke · Drogerie`

**stores**
`id · chain · name · lat · lng · address · distance_km · drive_min · department_layout jsonb · rewe_market_id text(nullable)`
— `rewe_market_id` ist die REWE-eigene Markt-ID ("wwIdent", nicht `id`), nur bei `chain='REWE'` gesetzt

## Rezepte
**recipes** `id · user_id · title · source_url · servings_base · prep_min · cook_min · difficulty · tags[] · kid_friendly · is_experimental · image_path`
**recipe_ingredients** `id · recipe_id · ingredient_id · amount · unit · note · is_optional`
**recipe_steps** `id · recipe_id · step_no · text`

## Planung
**meal_plans** `id · user_id · week_start date · status('draft'|'final'|'template') · source('manual'|'suggested') · template_name text(nullable, nur bei status='template')`
**meal_plan_entries** `id · plan_id · day int(0-6) · slot('mittag'|'abend') · recipe_id · servings · pinned bool`

## Einkauf
**shopping_lists** `id · plan_id · strategy('multi'|'single'|'rewe') · total_goods_cent · total_travel_cent · total_min · generated_at`
**shopping_items** `id · list_id · ingredient_id · amount · unit · department_id · store_id · pack_size · pack_count · unit_price_cent · total_cent · is_offer · offer_id · checked · reason text`
**pantry** `id · user_id · ingredient_id · amount · unit · updated_at`
**shopping_checked** `plan_id · ingredient_id · checked · updated_at` — Abhaken-Status pro Plan+Zutat (Liste selbst bleibt live aggregiert, keine `shopping_lists`/`shopping_items`-Persistenz vor Phase 5)

## Angebote
**offers** `id · store_id · ingredient_id(null) · raw_title · brand · amount · unit · price_cent · base_price_cent · valid_from · valid_to · source · confidence`
— `amount`/`unit` sind auf Basiseinheit normalisiert (g/ml/stk, wie `recipe_ingredients`), `price_cent` gilt für `(amount, unit)`. Normalisierung per `ingest/parsing/quantity.py` aus dem Prospekt-Rohtext; kein Treffer → beide `null`, Zeile bleibt trotzdem in `offers` (Review-UI), zählt aber nicht in Preisvergleichen mit, die `amount`/`unit` brauchen.
→ Index `(store_id, valid_from, valid_to)`, `(ingredient_id)`
**price_history** `ingredient_id · store_id · price_cent · observed_at` (für Plausibilitätsprüfung)
**rewe_prices** `id · ingredient_id · product_name · amount · unit · price_cent · is_offer · market_id · fetched_at`

## Lernen
**habit_events** `id · user_id · event_type · recipe_id · ingredient_id · payload jsonb · created_at`
**taste_profile** `user_id · ingredient_id · score numeric(-1..1) · n_seen · last_seen`
**recipe_stats** `user_id · recipe_id · times_planned · times_swapped_out · avg_gap_days · last_planned`

## Ernährung
**household_members** `id · user_id · name · age · activity('normal'|'sport_hoch') · training_days int[]`
**nutrition_targets** `member_id · kcal · protein_g · iron_mg · calcium_mg`

## RLS-Muster
- Nutzertabellen: `USING (auth.uid() = user_id)`
- Globale Tabellen: `SELECT TO authenticated`, Schreiben nur `service_role`
