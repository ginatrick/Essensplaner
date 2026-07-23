import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWithHaikuFallback } from "./resolveWithHaikuFallback.ts";
import type { AnthropicMessagesClient } from "./haikuClassify.ts";

// Fake-Supabase: deckt lookupIngredientAlias (.from/select/ilike/rpc-fuzzy),
// die ingredients-Liste (.from("ingredients").select) und den Alias-Rückschreib-
// Call (.rpc("insert_ingredient_alias", ...)) ab.
function makeFakeSupabase(options: {
  exactData?: { ingredient_id: string; alias: string } | null;
  knownIngredients?: { id: string; name: string }[];
}) {
  const calls: { rpcWrite: unknown[] } = { rpcWrite: [] };
  return {
    calls,
    from(table: string) {
      if (table === "ingredients") {
        return {
          select(_cols: string) {
            return {
              async limit(_n: number) {
                return { data: options.knownIngredients ?? [], error: null };
              },
            };
          },
        };
      }
      return {
        select(_cols: string) {
          return {
            ilike(_column: string, _value: string) {
              return {
                limit(_n: number) {
                  return {
                    async maybeSingle() {
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
      if (name === "insert_ingredient_alias") {
        calls.rpcWrite.push(params);
        return { data: null, error: null };
      }
      // Fuzzy-Lookup: kein Treffer, damit der Test gezielt den Haiku-Pfad prüft.
      return { data: [], error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeFakeHaiku(ingredientId: string | null): AnthropicMessagesClient {
  return {
    messages: {
      async create() {
        return { content: [{ type: "tool_use", input: { ingredient_id: ingredientId } }] };
      },
    },
  };
}

test("Alias-Treffer (exakt) → kein Haiku-Call, keine Alias-Schreibung", async () => {
  const supabase = makeFakeSupabase({ exactData: { ingredient_id: "ing-1", alias: "olivenöl" } });
  const haiku = makeFakeHaiku("sollte-nicht-verwendet-werden");

  const result = await resolveWithHaikuFallback(supabase, haiku, "Olivenöl");

  assert.equal(result, "ing-1");
  assert.equal(supabase.calls.rpcWrite.length, 0);
});

test("Alias-Miss, Haiku-Treffer → ingredient_id zurück UND Alias geschrieben", async () => {
  const supabase = makeFakeSupabase({
    exactData: null,
    knownIngredients: [{ id: "ing-2", name: "Petersilie" }],
  });
  const haiku = makeFakeHaiku("ing-2");

  const result = await resolveWithHaikuFallback(supabase, haiku, "glatte Petersilie");

  assert.equal(result, "ing-2");
  assert.deepEqual(supabase.calls.rpcWrite, [
    { p_ingredient_id: "ing-2", p_alias: "glatte Petersilie", p_source: "recipe", p_confidence: null },
  ]);
});

test("Alias-Miss, auch Haiku findet nichts → null, kein Schreibversuch", async () => {
  const supabase = makeFakeSupabase({
    exactData: null,
    knownIngredients: [{ id: "ing-2", name: "Petersilie" }],
  });
  const haiku = makeFakeHaiku(null);

  const result = await resolveWithHaikuFallback(supabase, haiku, "Einhornstaub");

  assert.equal(result, null);
  assert.equal(supabase.calls.rpcWrite.length, 0);
});

test("Leerer Name → null ohne DB- oder Haiku-Aufruf", async () => {
  const supabase = makeFakeSupabase({});
  let haikuCalled = false;
  const haiku: AnthropicMessagesClient = {
    messages: {
      async create() {
        haikuCalled = true;
        return { content: [] };
      },
    },
  };

  const result = await resolveWithHaikuFallback(supabase, haiku, "   ");

  assert.equal(result, null);
  assert.equal(haikuCalled, false);
});
