"use server";

import Anthropic from "@anthropic-ai/sdk";
import { parseIngredientLine } from "@/lib/recipes/parseLine";
import { resolveWithHaikuFallback } from "@/lib/recipes/resolveWithHaikuFallback";
import { extractRecipeFromHtml, RecipeJsonLdError, type RawRecipeDraft } from "@/lib/recipes/importJsonLd";
import { findDuplicateRecipes } from "@/lib/recipes/findDuplicates";
import { toIngredientBaseUnit } from "@/lib/units/convert";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type FormIngredient = { amount: string; unit: string; name: string; note: string | null; ingredient_id: string | null; error?: string };
export type ImportedRecipeDraft = Omit<RawRecipeDraft, "ingredients"> & { ingredients: FormIngredient[] };
export type ImportState = { draft?: ImportedRecipeDraft; error?: string };

export async function importRecipe(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const input = String(formData.get("url") ?? "").trim();
  let url: URL;
  try {
    url = new URL(input);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return { error: "Bitte eine gültige http(s)-Rezept-URL eingeben." };
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "MealPlanner Recipe Import/1.0 (+https://schema.org/Recipe)" },
    });
    if (!response.ok) return { error: `Die Rezeptseite konnte nicht geladen werden (HTTP ${response.status}).` };
    const raw = extractRecipeFromHtml(await response.text());
    const supabase = await createClient();
    const ingredients = await Promise.all(raw.ingredients.map(async (line) => {
      const parsed = parseIngredientLine(line);
      try {
        // Stufen 1-3 aus docs/05-modul-rezepte.md: Regex bereits oben, hier
        // Alias exakt/Fuzzy und bei Miss Haiku-Fallback (nur im automatisierten
        // Import-Pfad, nicht im manuellen Formular — Kostengrund docs/11).
        const ingredientId = await resolveWithHaikuFallback(supabase, anthropic, parsed.name);
        return { amount: String(parsed.amount), unit: parsed.unit ?? "", name: parsed.name, note: parsed.note, ingredient_id: ingredientId, ...(ingredientId ? {} : { error: "Keine Zutat gefunden." }) };
      } catch {
        return { amount: String(parsed.amount), unit: parsed.unit ?? "", name: parsed.name, note: parsed.note, ingredient_id: null, error: "Zutatensuche fehlgeschlagen." };
      }
    }));
    return { draft: { ...raw, source_url: input, ingredients } };
  } catch (error) {
    if (error instanceof RecipeJsonLdError) return { error: error.message };
    if (error instanceof DOMException && error.name === "TimeoutError") return { error: "Der Abruf der Rezeptseite hat zu lange gedauert." };
    return { error: "Die Rezeptseite konnte nicht abgerufen werden. Bitte URL und Internetzugang prüfen." };
  }
}

export type BulkImportResult = { url: string; status: "imported" | "duplicate" | "error"; title?: string; error?: string };

// Direktspeicherung mehrerer Rezepte ohne manuelle Prüfung pro Rezept (anders
// als importRecipe/RezeptForm-Flow) — für Massenimport aus einer externen
// Quelle. Pause zwischen den Requests (Höflichkeit ggü. der Quelle, siehe
// docs/13-recht-risiken.md), sequenziell statt parallel aus demselben Grund.
export async function importRecipesBulk(urls: string[]): Promise<BulkImportResult[]> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return urls.map((url) => ({ url, status: "error", error: "Nicht eingeloggt." }));
  const userId = userData.user.id;

  const results: BulkImportResult[] = [];
  for (const url of urls) {
    if (results.length > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "MealPlanner Recipe Import/1.0 (+https://schema.org/Recipe)" },
      });
      if (!response.ok) { results.push({ url, status: "error", error: `HTTP ${response.status}` }); continue; }
      const raw = extractRecipeFromHtml(await response.text());

      const parsedIngredients = await Promise.all(raw.ingredients.map(async (line) => {
        const parsed = parseIngredientLine(line);
        const ingredientId = await resolveWithHaikuFallback(supabase, anthropic, parsed.name).catch(() => null);
        return { ...parsed, ingredientId };
      }));

      const ingredientIds = parsedIngredients.map((p) => p.ingredientId).filter((id): id is string => !!id);
      const duplicates = await findDuplicateRecipes(supabase, { title: raw.title, ingredientIds });
      if (duplicates.length > 0) { results.push({ url, status: "duplicate", title: raw.title }); continue; }

      const { data: recipe, error: recipeError } = await supabase.from("recipes").insert({
        title: raw.title, source_url: url, servings_base: raw.servings_base ?? 4,
        prep_min: raw.prep_min ?? null, cook_min: raw.cook_min ?? null, user_id: userId,
      }).select("id").single();
      if (recipeError || !recipe) { results.push({ url, status: "error", error: recipeError?.message ?? "Speichern fehlgeschlagen." }); continue; }

      const steps = raw.steps.map((text, i) => ({ recipe_id: recipe.id, step_no: i + 1, text })).filter((s) => s.text.trim());
      if (steps.length) await supabase.from("recipe_steps").insert(steps);

      // Basiseinheit/Dichte der getroffenen Zutaten einmal sammeln, damit die
      // Mengen auf die Einheit der Zutat angeglichen werden können (sonst
      // landet "1 TL Salz" als 5 ml in einer Zutat, die in g geführt wird,
      // und die Einkaufsliste addiert ml zu g).
      const hitIds = [...new Set(parsedIngredients.map((p) => p.ingredientId).filter((id): id is string => !!id))];
      const { data: unitRows } = hitIds.length
        ? await supabase.from("ingredients").select("id, base_unit, density_g_ml, department_id").in("id", hitIds)
        : { data: [] };
      const unitById = new Map((unitRows ?? []).map((r) => [r.id, r]));

      const ingredientRows = [];
      const draftRows = [];
      for (const p of parsedIngredients) {
        if (!p.name.trim()) continue;
        if (!p.ingredientId) { draftRows.push({ recipe_id: recipe.id, raw_name: p.name, amount: String(p.amount), unit: p.unit, note: p.note }); continue; }
        try {
          const target = unitById.get(p.ingredientId);
          const converted = p.unit && target
            ? toIngredientBaseUnit({ amount: p.amount, unit: p.unit }, target)
            : { amount: p.amount, unit: (target?.base_unit ?? "stk") as "g" | "ml" | "stk" };
          ingredientRows.push({ recipe_id: recipe.id, ingredient_id: p.ingredientId, amount: converted.amount, unit: converted.unit, note: p.note });
        } catch {
          draftRows.push({ recipe_id: recipe.id, raw_name: p.name, amount: String(p.amount), unit: p.unit, note: p.note });
        }
      }
      if (ingredientRows.length) await supabase.from("recipe_ingredients").insert(ingredientRows);
      if (draftRows.length) await supabase.from("recipe_ingredient_drafts").insert(draftRows);

      results.push({ url, status: "imported", title: raw.title });
    } catch (error) {
      const message = error instanceof RecipeJsonLdError ? error.message
        : error instanceof DOMException && error.name === "TimeoutError" ? "Timeout"
        : "Abruf fehlgeschlagen";
      results.push({ url, status: "error", error: message });
    }
  }
  return results;
}
