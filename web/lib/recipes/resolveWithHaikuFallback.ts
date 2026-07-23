import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupIngredientAlias, writeIngredientAlias } from "./lookupAlias.ts";
import { haikuClassify, type AnthropicMessagesClient } from "./haikuClassify.ts";
import { slugifyDe } from "../text/slugifyDe.ts";

// Stufe 2b: direkter Slug-Treffer auf ingredients. lookupIngredientAlias
// durchsucht nur ingredient_aliases — eine Zutat, die in ingredients steht,
// aber noch keinen Alias-Eintrag hat ("Mandeln", "Feta", "Eier", ...), fiel
// deshalb bis zum LLM durch, obwohl der Name exakt übereinstimmt. Über den
// Slug statt den Namen verglichen, damit "Kaese"/"Käse" identisch matchen.
// Deterministisch, kostenlos und unabhängig davon, ob die Anthropic-API
// gerade erreichbar ist.
async function lookupIngredientBySlug(supabase: SupabaseClient, name: string): Promise<string | null> {
  const slug = slugifyDe(name);
  if (!slug) return null;

  const exact = await supabase.from("ingredients").select("id").eq("slug", slug).limit(1).maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) return exact.data.id as string;

  // Präfix-Treffer nur, wenn eindeutig ("risottoreis" -> "risottoreis-bio").
  // Bei "milch" (Milch 3,5% / Milch 1,5%) wäre jede Wahl geraten — das ist
  // keine Aufgabe für eine Textregel, das entscheidet die nächste Stufe.
  const prefix = await supabase.from("ingredients").select("id").like("slug", `${slug}-%`).limit(2);
  if (prefix.error) throw prefix.error;
  return prefix.data?.length === 1 ? (prefix.data[0].id as string) : null;
}

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

  const bySlug = await lookupIngredientBySlug(supabase, trimmed);
  if (bySlug) {
    await writeIngredientAlias(supabase, { ingredientId: bySlug, alias: trimmed, source: "recipe" });
    return bySlug;
  }

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
