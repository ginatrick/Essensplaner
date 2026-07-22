import type { SupabaseClient } from "@supabase/supabase-js";

export type DuplicateCandidate = {
  recipeId: string;
  title: string;
  titleSimilarity: number;
  ingredientOverlap: number;
  score: number;
};

// Nur Kandidaten über dieser Schwelle sind fürs Formular relevant genug, um
// den Nutzer zu unterbrechen.
const DUPLICATE_SCORE_THRESHOLD = 0.5;

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Duplikaterkennung aus docs/05-modul-rezepte.md DoD: Titel-Fuzzy (RPC
// match_recipe_titles_fuzzy, Migration 20260722160000) kombiniert mit
// Zutaten-Overlap (Jaccard über ingredient_id-Sets). Score = Maximum aus
// beidem — ein sehr ähnlicher Titel ODER eine sehr ähnliche Zutatenliste
// reicht schon für eine Warnung.
export async function findDuplicateRecipes(
  supabase: SupabaseClient,
  input: { title: string; ingredientIds: string[]; excludeRecipeId?: string },
): Promise<DuplicateCandidate[]> {
  const title = input.title.trim();
  if (!title) return [];

  const { data: titleMatches, error: titleError } = await supabase.rpc("match_recipe_titles_fuzzy", {
    search: title,
    min_similarity: 0.3,
    match_limit: 5,
  });
  if (titleError) throw titleError;

  const candidates: { id: string; title: string; similarity: number }[] = (titleMatches ?? []).filter(
    (row: { id: string }) => row.id !== input.excludeRecipeId,
  );
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);
  const { data: ingredientRows, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredient_id")
    .in("recipe_id", candidateIds);
  if (ingredientError) throw ingredientError;

  const ingredientsByRecipe = new Map<string, string[]>();
  for (const row of (ingredientRows ?? []) as { recipe_id: string; ingredient_id: string }[]) {
    const list = ingredientsByRecipe.get(row.recipe_id) ?? [];
    list.push(row.ingredient_id);
    ingredientsByRecipe.set(row.recipe_id, list);
  }

  return candidates
    .map((candidate) => {
      const titleSimilarity = candidate.similarity;
      const ingredientOverlap = jaccard(input.ingredientIds, ingredientsByRecipe.get(candidate.id) ?? []);
      return {
        recipeId: candidate.id,
        title: candidate.title,
        titleSimilarity,
        ingredientOverlap,
        score: Math.max(titleSimilarity, ingredientOverlap),
      };
    })
    .filter((candidate) => candidate.score >= DUPLICATE_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}
