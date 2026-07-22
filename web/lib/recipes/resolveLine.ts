import type { SupabaseClient } from "@supabase/supabase-js";
import { toBaseUnit, type BaseUnit } from "../units/convert.ts";
import { parseIngredientLine } from "./parseLine.ts";
import { lookupIngredientAlias } from "./lookupAlias.ts";

export type ResolvedRecipeLine = {
  amount: number;
  unit: BaseUnit;
  ingredient_id: string | null;
  raw_name: string;
};

// Verbindet Regex-Split (Stufe 1) und Alias-Lookup (Stufe 2) zu einer fertigen
// recipe_ingredients-Zeile. Kein LLM-Aufruf hier — Miss bleibt ingredient_id=null,
// das ist der nächste Roadmap-Schritt (Haiku-Fallback + Alias-Rückschreibung).
export async function resolveRecipeLine(
  supabase: SupabaseClient,
  text: string,
): Promise<ResolvedRecipeLine> {
  const parsed = parseIngredientLine(text);
  const match = await lookupIngredientAlias(supabase, parsed.name);

  // Kein Einheiten-Wort erkannt (z.B. "3 Eier") → Stückgut, analog zu
  // Bund/Zehe/Stück in convert.ts.
  const base = parsed.unit
    ? toBaseUnit({ amount: parsed.amount, unit: parsed.unit })
    : { amount: parsed.amount, unit: "stk" as BaseUnit };

  return {
    amount: base.amount,
    unit: base.unit,
    ingredient_id: match?.ingredientId ?? null,
    raw_name: parsed.name,
  };
}
