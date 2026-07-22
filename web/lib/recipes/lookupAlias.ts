import type { SupabaseClient } from "@supabase/supabase-js";

export type AliasMatch = {
  ingredientId: string;
  alias: string;
  matchType: "exact" | "fuzzy";
  confidence: number;
};

// Schwelle für die Trigram-Ähnlichkeit (0..1). Unterhalb kein Treffer — lieber
// kein Match als ein falscher, denn die nächste Stufe (Haiku) baut darauf auf.
const FUZZY_MATCH_THRESHOLD = 0.4;

// Supabase ILIKE ohne Wildcards ist case-insensitiv exakt; % und _ im Suchtext
// müssen escaped werden, damit sie nicht als Wildcard interpretiert werden.
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (char) => `\\${char}`);
}

// Stufe 2 aus docs/05-modul-rezepte.md: erst exakter Alias-Treffer, dann
// Trigram-Fuzzy über die RPC aus der Migration ingredient_alias_lookup.
export async function lookupIngredientAlias(
  supabase: SupabaseClient,
  name: string,
): Promise<AliasMatch | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const exact = await supabase
    .from("ingredient_aliases")
    .select("ingredient_id, alias")
    .ilike("alias", escapeIlike(trimmed))
    .limit(1)
    .maybeSingle();

  if (exact.error) throw exact.error;
  if (exact.data) {
    return {
      ingredientId: exact.data.ingredient_id,
      alias: exact.data.alias,
      matchType: "exact",
      confidence: 1,
    };
  }

  const fuzzy = await supabase.rpc("match_ingredient_alias_fuzzy", {
    search: trimmed,
    min_similarity: FUZZY_MATCH_THRESHOLD,
    match_limit: 1,
  });

  if (fuzzy.error) throw fuzzy.error;
  const top = fuzzy.data?.[0];
  if (!top) return null;

  return {
    ingredientId: top.ingredient_id,
    alias: top.alias,
    matchType: "fuzzy",
    confidence: top.similarity,
  };
}

// Schreibt einen neu erkannten Alias zurück (docs/05-modul-rezepte.md Schritt 3:
// "Jeder LLM-Treffer schreibt einen Alias zurück"). Läuft über die
// SECURITY DEFINER-RPC aus Migration 20260722140000, weil ingredient_aliases
// laut RLS nur für service_role direkt beschreibbar ist. Die RPC ist
// idempotent (on conflict (lower(alias)) do nothing) — ein zweiter Aufruf mit
// demselben Alias-Text ist ein No-Op, kein Fehler.
export async function writeIngredientAlias(
  supabase: SupabaseClient,
  input: { ingredientId: string; alias: string; source?: "recipe" | "offer" | "rewe"; confidence?: number | null },
): Promise<void> {
  const { error } = await supabase.rpc("insert_ingredient_alias", {
    p_ingredient_id: input.ingredientId,
    p_alias: input.alias,
    p_source: input.source ?? "recipe",
    p_confidence: input.confidence ?? null,
  });

  if (error) throw error;
}
