import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupIngredientAlias, writeIngredientAlias } from "./lookupAlias.ts";

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

// Fake-Client für writeIngredientAlias: bildet nur .rpc("insert_ingredient_alias", ...)
// nach. Die eigentliche Idempotenz (on conflict (lower(alias)) do nothing) lebt
// in der SQL-Funktion (Migration 20260722140000) und ist ohne echte DB nicht
// sinnvoll zu simulieren — hier wird nachgebildet, dass ein zweiter Aufruf mit
// demselben Alias-Text genau wie der erste kein error zurückgibt (No-Op).
function makeFakeSupabaseForWrite(options: { error?: Error } = {}) {
  const calls: { rpc?: [string, unknown][] } = { rpc: [] };
  return {
    calls,
    async rpc(name: string, params: unknown) {
      calls.rpc!.push([name, params]);
      return { data: null, error: options.error ?? null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("writeIngredientAlias ruft die RPC mit den richtigen Parametern auf", async () => {
  const supabase = makeFakeSupabaseForWrite();

  await writeIngredientAlias(supabase, { ingredientId: "ing-1", alias: "glatte Petersilie", confidence: 0.9 });

  assert.deepEqual(supabase.calls.rpc[0], [
    "insert_ingredient_alias",
    { p_ingredient_id: "ing-1", p_alias: "glatte Petersilie", p_source: "recipe", p_confidence: 0.9 },
  ]);
});

test("writeIngredientAlias: Fehler der RPC wird weitergereicht", async () => {
  const supabase = makeFakeSupabaseForWrite({ error: new Error("insert failed") });

  await assert.rejects(
    () => writeIngredientAlias(supabase, { ingredientId: "ing-1", alias: "x" }),
    /insert failed/,
  );
});

test("writeIngredientAlias: zweiter Aufruf mit demselben Alias ist idempotent (No-Op, kein Fehler)", async () => {
  const supabase = makeFakeSupabaseForWrite();

  await writeIngredientAlias(supabase, { ingredientId: "ing-1", alias: "glatte Petersilie" });
  await writeIngredientAlias(supabase, { ingredientId: "ing-1", alias: "glatte Petersilie" });

  assert.equal(supabase.calls.rpc.length, 2);
});
