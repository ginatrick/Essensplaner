"use server";

import Anthropic from "@anthropic-ai/sdk";
import { parseIngredientLine } from "@/lib/recipes/parseLine";
import { resolveWithHaikuFallback } from "@/lib/recipes/resolveWithHaikuFallback";
import { extractRecipeFromHtml, RecipeJsonLdError, type RawRecipeDraft } from "@/lib/recipes/importJsonLd";
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
