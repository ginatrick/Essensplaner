import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupIngredientAlias, writeIngredientAlias } from "./lookupAlias.ts";
import { haikuClassify, type AnthropicMessagesClient } from "./haikuClassify.ts";

// Verbindet Stufe 1-2 (Alias-Lookup exakt/Fuzzy) mit Stufe 3 (Haiku-Fallback)
// aus docs/05-modul-rezepte.md. Nur für automatisierte Pfade (z.B. URL-Import)
// gedacht — das manuelle Formular ruft weiterhin nur lookupIngredientAlias auf,
// kein LLM-Call bei Formular-Eingabe (Kostengrund siehe docs/11-modellwahl.md).
//
// Bei Haiku-Treffer wird der Alias zurückgeschrieben, damit derselbe Text beim
// nächsten Mal schon in Stufe 2 (exakt) matcht — der Parser wird über die Zeit
// deterministisch und kostenlos.
export async function resolveWithHaikuFallback(
  supabase: SupabaseClient,
  haiku: AnthropicMessagesClient,
  rawName: string,
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const direct = await lookupIngredientAlias(supabase, trimmed);
  if (direct) return direct.ingredientId;

  // Explizites Limit: Supabase/PostgREST deckelt Abfragen ohne .limit() auf
  // standardmäßig 1000 Zeilen. Bei > 1000 ingredients (aktuell 1001) würde
  // sonst in unbestimmter Reihenfolge abgeschnitten — Haiku bekäme nicht mal
  // die volle Liste zu sehen und könnte selbst einen exakten Namen wie "Mais"
  // verpassen, falls die Zeile außerhalb des Caps liegt.
  const { data, error } = await supabase.from("ingredients").select("id, name").limit(5000);
  if (error) throw error;
  const known: { id: string; name: string }[] = data ?? [];
  if (known.length === 0) return null;

  const ingredientId = await haikuClassify(haiku, trimmed, known);
  if (!ingredientId) return null;

  await writeIngredientAlias(supabase, { ingredientId, alias: trimmed, source: "recipe" });
  return ingredientId;
}
