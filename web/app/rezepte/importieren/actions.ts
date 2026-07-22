"use server";

import { parseIngredientLine } from "@/lib/recipes/parseLine";
import { lookupIngredientAlias } from "@/lib/recipes/lookupAlias";
import { extractRecipeFromHtml, RecipeJsonLdError, type RawRecipeDraft } from "@/lib/recipes/importJsonLd";
import { createClient } from "@/lib/supabase/server";

type FormIngredient = { amount: string; unit: string; name: string; ingredient_id: string | null; error?: string };
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
        const alias = await lookupIngredientAlias(supabase, parsed.name);
        return { amount: String(parsed.amount), unit: parsed.unit ?? "", name: parsed.name, ingredient_id: alias?.ingredientId ?? null, ...(alias ? {} : { error: "Keine Zutat gefunden." }) };
      } catch {
        return { amount: String(parsed.amount), unit: parsed.unit ?? "", name: parsed.name, ingredient_id: null, error: "Zutatensuche fehlgeschlagen." };
      }
    }));
    return { draft: { ...raw, source_url: input, ingredients } };
  } catch (error) {
    if (error instanceof RecipeJsonLdError) return { error: error.message };
    if (error instanceof DOMException && error.name === "TimeoutError") return { error: "Der Abruf der Rezeptseite hat zu lange gedauert." };
    return { error: "Die Rezeptseite konnte nicht abgerufen werden. Bitte URL und Internetzugang prüfen." };
  }
}
