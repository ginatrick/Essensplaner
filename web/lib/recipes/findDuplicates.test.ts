import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateRecipes } from "./findDuplicates.ts";

// Fake-Client: bildet nur .rpc("match_recipe_titles_fuzzy", ...) und
// .from("recipe_ingredients").select().in() nach. Kein echter Netzwerk-/DB-Zugriff.
function makeFakeSupabase(options: {
  titleMatches?: { id: string; title: string; similarity: number }[];
  titleError?: Error;
  ingredientRows?: { recipe_id: string; ingredient_id: string }[];
  ingredientError?: Error;
}) {
  const calls: { rpc?: [string, unknown]; in?: [string, string[]] } = {};

  return {
    calls,
    async rpc(name: string, params: unknown) {
      calls.rpc = [name, params];
      if (options.titleError) return { data: null, error: options.titleError };
      return { data: options.titleMatches ?? [], error: null };
    },
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            in(column: string, values: string[]) {
              calls.in = [column, values];
              if (options.ingredientError) return { data: null, error: options.ingredientError };
              return { data: options.ingredientRows ?? [], error: null };
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("Leerer Titel-Kandidatenset → leeres Ergebnis, keine Ingredient-Query", async () => {
  const supabase = makeFakeSupabase({ titleMatches: [] });

  const result = await findDuplicateRecipes(supabase, { title: "Spaghetti Bolognese", ingredientIds: ["a", "b"] });

  assert.deepEqual(result, []);
  assert.equal(supabase.calls.in, undefined);
});

test("Leerer Titel → leeres Ergebnis ohne RPC-Aufruf", async () => {
  const supabase = makeFakeSupabase({});

  const result = await findDuplicateRecipes(supabase, { title: "   ", ingredientIds: ["a"] });

  assert.deepEqual(result, []);
  assert.equal(supabase.calls.rpc, undefined);
});

test("Zutaten-Overlap wird korrekt per Jaccard berechnet", async () => {
  const supabase = makeFakeSupabase({
    titleMatches: [{ id: "r1", title: "Spaghetti Carbonara", similarity: 0.2 }],
    ingredientRows: [
      { recipe_id: "r1", ingredient_id: "spaghetti" },
      { recipe_id: "r1", ingredient_id: "ei" },
      { recipe_id: "r1", ingredient_id: "speck" },
      { recipe_id: "r1", ingredient_id: "parmesan" },
    ],
  });

  // Neue Zutaten: spaghetti, ei, parmesan, sahne → Schnitt {spaghetti, ei, parmesan}=3,
  // Vereinigung {spaghetti, ei, speck, parmesan, sahne}=5 → Jaccard = 3/5 = 0.6
  const result = await findDuplicateRecipes(supabase, {
    title: "Spaghetti Carbonara",
    ingredientIds: ["spaghetti", "ei", "parmesan", "sahne"],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].ingredientOverlap, 0.6);
  assert.equal(result[0].score, 0.6);
});

test("excludeRecipeId wird aus den Kandidaten herausgefiltert", async () => {
  const supabase = makeFakeSupabase({
    titleMatches: [
      { id: "self", title: "Spaghetti Carbonara", similarity: 1 },
      { id: "other", title: "Spaghetti Carbonara Deluxe", similarity: 0.6 },
    ],
    ingredientRows: [],
  });

  const result = await findDuplicateRecipes(supabase, {
    title: "Spaghetti Carbonara",
    ingredientIds: [],
    excludeRecipeId: "self",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].recipeId, "other");
});

test("Schwelle greift: Kandidat unter 0.5 Score wird nicht zurückgegeben", async () => {
  const supabase = makeFakeSupabase({
    titleMatches: [
      { id: "close", title: "Ähnliches Gericht", similarity: 0.55 },
      { id: "far", title: "Ganz anderes Gericht", similarity: 0.35 },
    ],
    ingredientRows: [],
  });

  const result = await findDuplicateRecipes(supabase, { title: "Ähnliches Gericht", ingredientIds: [] });

  assert.equal(result.length, 1);
  assert.equal(result[0].recipeId, "close");
});

test("Ergebnis nach Score absteigend sortiert", async () => {
  const supabase = makeFakeSupabase({
    titleMatches: [
      { id: "low", title: "A", similarity: 0.55 },
      { id: "high", title: "B", similarity: 0.9 },
    ],
    ingredientRows: [],
  });

  const result = await findDuplicateRecipes(supabase, { title: "A", ingredientIds: [] });

  assert.deepEqual(result.map((r) => r.recipeId), ["high", "low"]);
});

test("RPC-Fehler wird weitergereicht", async () => {
  const supabase = makeFakeSupabase({ titleError: new Error("rpc down") });

  await assert.rejects(
    () => findDuplicateRecipes(supabase, { title: "Spaghetti", ingredientIds: [] }),
    /rpc down/,
  );
});

test("Ingredient-Query-Fehler wird weitergereicht", async () => {
  const supabase = makeFakeSupabase({
    titleMatches: [{ id: "r1", title: "Spaghetti", similarity: 0.6 }],
    ingredientError: new Error("ingredients down"),
  });

  await assert.rejects(
    () => findDuplicateRecipes(supabase, { title: "Spaghetti", ingredientIds: [] }),
    /ingredients down/,
  );
});
