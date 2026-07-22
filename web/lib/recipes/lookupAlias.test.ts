import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupIngredientAlias } from "./lookupAlias.ts";

// Fake-Client: bildet nur die Methoden nach, die lookupAlias.ts tatsächlich
// aufruft (.from().select().ilike().limit().maybeSingle() und .rpc()).
// Kein echter Netzwerk-/DB-Zugriff.
function makeFakeSupabase(options: {
  exactData?: { ingredient_id: string; alias: string } | null;
  exactError?: Error;
  fuzzyData?: { ingredient_id: string; alias: string; similarity: number }[];
  fuzzyError?: Error;
}) {
  const calls: { ilike?: [string, string]; rpc?: [string, unknown] } = {};

  return {
    calls,
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            ilike(column: string, value: string) {
              calls.ilike = [column, value];
              return {
                limit(_n: number) {
                  return {
                    async maybeSingle() {
                      if (options.exactError) return { data: null, error: options.exactError };
                      return { data: options.exactData ?? null, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(name: string, params: unknown) {
      calls.rpc = [name, params];
      if (options.fuzzyError) return { data: null, error: options.fuzzyError };
      return { data: options.fuzzyData ?? [], error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("Exakter Treffer: kein Fuzzy-RPC-Aufruf, confidence=1", async () => {
  const supabase = makeFakeSupabase({
    exactData: { ingredient_id: "ing-1", alias: "olivenöl" },
  });

  const result = await lookupIngredientAlias(supabase, "Olivenöl");

  assert.deepEqual(result, {
    ingredientId: "ing-1",
    alias: "olivenöl",
    matchType: "exact",
    confidence: 1,
  });
  assert.equal(supabase.calls.rpc, undefined);
});

test("Kein exakter Treffer → Fuzzy-RPC liefert Top-Match", async () => {
  const supabase = makeFakeSupabase({
    exactData: null,
    fuzzyData: [{ ingredient_id: "ing-2", alias: "olive öl", similarity: 0.62 }],
  });

  const result = await lookupIngredientAlias(supabase, "Olivenöhl");

  assert.deepEqual(result, {
    ingredientId: "ing-2",
    alias: "olive öl",
    matchType: "fuzzy",
    confidence: 0.62,
  });
  assert.ok(supabase.calls.rpc);
  assert.equal(supabase.calls.rpc?.[0], "match_ingredient_alias_fuzzy");
});

test("Weder exakt noch Fuzzy → null, kein Raten", async () => {
  const supabase = makeFakeSupabase({ exactData: null, fuzzyData: [] });

  const result = await lookupIngredientAlias(supabase, "Voodoozutat");

  assert.equal(result, null);
});

test("DB-Fehler beim exakten Lookup wird weitergereicht", async () => {
  const supabase = makeFakeSupabase({ exactError: new Error("db down") });

  await assert.rejects(() => lookupIngredientAlias(supabase, "Salz"), /db down/);
});

test("Leerer Name → null ohne DB-Aufruf", async () => {
  const supabase = makeFakeSupabase({});

  const result = await lookupIngredientAlias(supabase, "   ");

  assert.equal(result, null);
});
