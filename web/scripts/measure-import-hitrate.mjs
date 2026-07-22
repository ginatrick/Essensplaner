// Einmalig/gelegentlich von Hand ausführen: docs/05-modul-rezepte.md DoD
// "URL-Import ≥ 85 % korrekte Zutatenerkennung auf 20 Testseiten".
// Braucht SUPABASE_SERVICE_ROLE_KEY (RLS-Bypass, da kein Browser-Login hier)
// und ANTHROPIC_API_KEY in der Umgebung. Erwartet ein Verzeichnis mit
// gespeicherten Rezept-HTML-Dateien als erstes Argument.
//
// Nutzung: node scripts/measure-import-hitrate.mjs <verzeichnis-mit-html-dateien>

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { extractRecipeFromHtml } from "../lib/recipes/importJsonLd.ts";
import { parseIngredientLine } from "../lib/recipes/parseLine.ts";
import { resolveWithHaikuFallback } from "../lib/recipes/resolveWithHaikuFallback.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("Nutzung: node scripts/measure-import-hitrate.mjs <verzeichnis>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
let totalIngredients = 0;
let matched = 0;
let extractionFailures = 0;

for (const file of files) {
  const html = readFileSync(path.join(dir, file), "utf-8");
  let draft;
  try {
    draft = extractRecipeFromHtml(html);
  } catch (error) {
    extractionFailures++;
    console.log(`FEHLER Extraktion: ${file} — ${error.message}`);
    continue;
  }

  let fileMatched = 0;
  for (const line of draft.ingredients) {
    totalIngredients++;
    const parsed = parseIngredientLine(line);
    const id = await resolveWithHaikuFallback(supabase, anthropic, parsed.name);
    if (id) { matched++; fileMatched++; }
  }
  const rate = draft.ingredients.length ? ((fileMatched / draft.ingredients.length) * 100).toFixed(0) : "n/a";
  console.log(`${file}: "${draft.title}" — ${fileMatched}/${draft.ingredients.length} Zutaten (${rate}%)`);
}

console.log("\n--- Gesamt ---");
console.log(`Seiten: ${files.length}, Extraktion fehlgeschlagen: ${extractionFailures}`);
console.log(`Zutaten gesamt: ${totalIngredients}, Treffer: ${matched}`);
console.log(`Trefferquote: ${totalIngredients ? ((matched / totalIngredients) * 100).toFixed(1) : "n/a"}%`);
