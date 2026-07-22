import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRecipeLine } from "./resolveLine.ts";

function makeFakeSupabase(exactData: { ingredient_id: string; alias: string } | null) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            ilike(_column: string, _value: string) {
              return {
                limit(_n: number) {
                  return {
                    async maybeSingle() {
                      return { data: exactData, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(_name: string, _params: unknown) {
      return { data: [], error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("Regex + Alias-Treffer + Unit-Konversion greifen ineinander", async () => {
  const supabase = makeFakeSupabase({ ingredient_id: "ing-öl", alias: "olivenöl" });

  const result = await resolveRecipeLine(supabase, "2 EL Olivenöl");

  assert.deepEqual(result, {
    amount: 30,
    unit: "ml",
    ingredient_id: "ing-öl",
    raw_name: "Olivenöl",
  });
});

test("Kein Einheiten-Wort → Stückgut (stk)", async () => {
  const supabase = makeFakeSupabase(null);

  const result = await resolveRecipeLine(supabase, "3 Eier");

  assert.deepEqual(result, {
    amount: 3,
    unit: "stk",
    ingredient_id: null,
    raw_name: "Eier",
  });
});

test("Kein Alias-Treffer → ingredient_id=null, kein Raten", async () => {
  const supabase = makeFakeSupabase(null);

  const result = await resolveRecipeLine(supabase, "500g Yakonwurzel");

  assert.deepEqual(result, {
    amount: 500,
    unit: "g",
    ingredient_id: null,
    raw_name: "Yakonwurzel",
  });
});
