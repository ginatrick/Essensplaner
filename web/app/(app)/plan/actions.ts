"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { filterCandidatePool } from "@/lib/suggestions/candidates";
import { solveWeek } from "@/lib/suggestions/solver";
import { pickMainIngredient } from "@/lib/suggestions/mainIngredient";
import { explainSuggestion } from "@/lib/suggestions/explain";
import { evaluateWeek, type WeekAmpel } from "@/lib/plan/nutritionEvaluator";
import type { CandidateRecipe } from "@/lib/suggestions/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SuggestedSlotResult = { day: number; recipeId: string; title: string; isExploration: boolean };
export type SuggestedWeekResult = { slots: SuggestedSlotResult[]; explanation: string; ampel: WeekAmpel };

// Phase 7 (docs/10-modul-lernen.md): Kandidatenpool + Constraint-Solver +
// Haiku-Begründung. Läuft server-seitig (Anthropic-Key, breite Rezept-Query).
export async function generateWeekSuggestion(): Promise<SuggestedWeekResult | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Nicht angemeldet." };

  const [{ data: recipes }, { data: ingredientRows }, { data: tasteRows }, { data: statsRows }, { data: memberRows }] = await Promise.all([
    supabase.from("recipes").select("id, title, tags, prep_min, cook_min, is_experimental"),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, ingredient_id, amount, unit, is_optional, ingredients(season_months, iron_mg_100, calcium_mg_100)"),
    supabase.from("taste_profile").select("ingredient_id, score"),
    supabase.from("recipe_stats").select("recipe_id, last_planned"),
    supabase.from("household_members").select("training_days"),
  ]);

  if (!recipes || recipes.length === 0) return { error: "Noch keine Rezepte vorhanden." };

  const tasteByIngredient = new Map((tasteRows ?? []).map((t) => [t.ingredient_id, t.score as number]));
  const lastPlannedByRecipe = new Map((statsRows ?? []).map((s) => [s.recipe_id, s.last_planned as string | null]));
  const byRecipe = new Map<string, NonNullable<typeof ingredientRows>>();
  for (const row of ingredientRows ?? []) {
    if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
    byRecipe.get(row.recipe_id)!.push(row);
  }

  const currentMonth = new Date().getMonth() + 1;
  const candidates: CandidateRecipe[] = recipes.map((r) => {
    const rows = byRecipe.get(r.id) ?? [];
    const ing = (row: (typeof rows)[number]) => (Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients);

    const nutrients = rows.map((row) => ({ iron_mg_100: ing(row)?.iron_mg_100 ?? null, calcium_mg_100: ing(row)?.calcium_mg_100 ?? null }));
    const scores = rows.map((row) => tasteByIngredient.get(row.ingredient_id)).filter((s): s is number => s != null);
    const tasteScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const seasonal = rows.filter((row) => (ing(row)?.season_months?.length ?? 0) > 0);
    const inSeason = seasonal.length === 0 || seasonal.some((row) => ing(row)!.season_months!.includes(currentMonth));

    return {
      id: r.id,
      title: r.title,
      tags: r.tags,
      prep_min: r.prep_min,
      cook_min: r.cook_min,
      is_experimental: r.is_experimental,
      lastPlanned: lastPlannedByRecipe.get(r.id) ?? null,
      tasteScore,
      mainIngredientId: pickMainIngredient(rows.map((row) => ({ ingredient_id: row.ingredient_id, amount: row.amount, unit: row.unit, is_optional: row.is_optional }))),
      inSeason,
      ingredientNutrients: nutrients,
    };
  });

  const pool = filterCandidatePool(candidates, new Date());
  const trainingDays = [...new Set((memberRows ?? []).flatMap((m) => m.training_days ?? []))];
  const slots = solveWeek(pool, { trainingDays });

  if (slots.length === 0) {
    return { error: "Kein passendes Rezept gefunden. Mehr Rezepte anlegen oder es später erneut versuchen." };
  }

  const ampel = evaluateWeek(slots.map((s) => ({ day: s.day, tags: s.recipe.tags, ingredientNutrients: s.recipe.ingredientNutrients })));
  const improvedCriteria = ampel.criteria.filter((c) => c.ampel !== "rot").map((c) => c.label);
  const explorationTitles = slots.filter((s) => s.isExploration).map((s) => s.recipe.title);
  const favoriteTitles = candidates
    .filter((c) => c.tasteScore != null)
    .sort((a, b) => (b.tasteScore ?? 0) - (a.tasteScore ?? 0))
    .slice(0, 3)
    .map((c) => c.title);

  // Fällt die Begründung aus (Haiku-API-Fehler), soll der fertig berechnete
  // Vorschlag trotzdem nutzbar sein statt komplett zu scheitern.
  const explanation = await explainSuggestion(anthropic, { improvedCriteria, explorationTitles, favoriteTitles }).catch(
    () => "Diese Woche basiert auf deinen bisherigen Vorlieben.",
  );

  return {
    slots: slots.map((s) => ({ day: s.day, recipeId: s.recipe.id, title: s.recipe.title, isExploration: s.isExploration })),
    explanation,
    ampel,
  };
}
