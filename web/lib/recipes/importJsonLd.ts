import { decodeHtmlEntities } from "../text/decodeHtmlEntities.ts";

export type RawRecipeDraft = {
  title: string;
  source_url?: string;
  servings_base?: number;
  prep_min?: number;
  cook_min?: number;
  steps: string[];
  ingredients: string[];
};

export class RecipeJsonLdError extends Error {}

function isRecipe(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const type = (value as Record<string, unknown>)["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => typeof item === "string" && (item === "Recipe" || item.endsWith("/Recipe") || item.endsWith("#Recipe")));
}

function findRecipe(value: unknown): Record<string, unknown> | null {
  if (isRecipe(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipe(item);
      if (recipe) return recipe;
    }
  }
  if (value && typeof value === "object") {
    const graph = (value as Record<string, unknown>)["@graph"];
    if (graph) return findRecipe(graph);
  }
  return null;
}

function readJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scriptPattern = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Andere/defekte JSON-LD-Blöcke sollen gültige Blöcke nicht verhindern.
    }
  }
  return blocks;
}

function durationToMinutes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (!match || (!match[1] && !match[2])) return undefined;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

function firstInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstInteger(item);
      if (result !== undefined) return result;
    }
  }
  if (value && typeof value === "object") return firstInteger((value as Record<string, unknown>).value ?? value);
  return undefined;
}

function instructionTexts(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\r?\n/).map((text) => text.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(instructionTexts);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.text === "string") return [item.text.trim()].filter(Boolean);
    return instructionTexts(item.itemListElement);
  }
  return [];
}

export function extractRecipeFromHtml(html: string): RawRecipeDraft {
  const recipe = readJsonLdBlocks(html).map(findRecipe).find((item): item is Record<string, unknown> => item !== null);
  if (!recipe) throw new RecipeJsonLdError("Kein Rezept auf dieser Seite gefunden.");

  const title = typeof recipe.name === "string" ? decodeHtmlEntities(recipe.name.trim()) : "";
  if (!title) throw new RecipeJsonLdError("Das Rezept enthält keinen Titel.");
  return {
    title,
    servings_base: firstInteger(recipe.recipeYield),
    prep_min: durationToMinutes(recipe.prepTime),
    cook_min: durationToMinutes(recipe.cookTime),
    steps: instructionTexts(recipe.recipeInstructions).map(decodeHtmlEntities),
    ingredients: (Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter((item): item is string => typeof item === "string")
      : []
    ).map(decodeHtmlEntities),
  };
}
