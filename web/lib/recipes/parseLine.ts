import { isKnownUnitWord } from "../units/convert.ts";

export type ParsedIngredientLine = {
  amount: number;
  unit: string | null;
  name: string;
  note: string | null;
};

const LEADING_AMOUNT = /^(\d+(?:[.,]\d+)?)\s*/;
const FIRST_WORD = /^(\S+)\s*(.*)$/;
// Unicode-Brüche sind in Rezepttexten üblich ("½ TL Zimt") und wurden von
// LEADING_AMOUNT gar nicht erkannt — die ganze Zeile landete dann als Name
// im Entwurf, inklusive Menge und Einheit. Vor dem Zerlegen normalisieren.
const VULGAR_FRACTIONS: Record<string, string> = {
  "½": "0.5", "⅓": "0.333", "⅔": "0.667", "¼": "0.25", "¾": "0.75",
  "⅕": "0.2", "⅖": "0.4", "⅗": "0.6", "⅘": "0.8", "⅙": "0.167", "⅚": "0.833",
  "⅛": "0.125", "⅜": "0.375", "⅝": "0.625", "⅞": "0.875",
};

function normalizeFractions(value: string): string {
  // "1 ½" (gemischte Zahl) zuerst zusammenfassen, sonst bliebe die 1 stehen
  // und die Menge wäre um den Bruchteil zu klein.
  const combined = value.replace(
    new RegExp(`(\\d+)\\s*([${Object.keys(VULGAR_FRACTIONS).join("")}])`, "g"),
    (_m, whole: string, frac: string) => String(Number(whole) + Number(VULGAR_FRACTIONS[frac])),
  );
  return combined.replace(
    new RegExp(`[${Object.keys(VULGAR_FRACTIONS).join("")}]`, "g"),
    (frac) => VULGAR_FRACTIONS[frac],
  );
}
// Klammer-Zusätze wie "(à 140 g Abtropfgewicht)", "(gehackt)" sind
// Verpackungs-/Zubereitungshinweise, kein Teil des Zutatennamens — würden die
// Alias-/Fuzzy-Suche sonst leer laufen lassen (sucht nach dem ganzen Text
// inkl. Klammer statt nach "Mais"). Der Inhalt wird trotzdem als note
// aufgehoben statt verworfen (recipe_ingredients.note).
const PARENTHETICAL = /\s*\(([^)]*)\)/g;

function extractParenthetical(value: string): { name: string; note: string | null } {
  const notes: string[] = [];
  const name = value
    .replace(PARENTHETICAL, (_match, inner: string) => {
      notes.push(inner.trim());
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { name, note: notes.length ? notes.join("; ") : null };
}

// Regex-Split einer freien Zutatenzeile nach docs/05-modul-rezepte.md Schritt 1:
// Menge → optionales Einheiten-Wort (Alias-Tabelle aus convert.ts) → Rest = Name.
export function parseIngredientLine(text: string): ParsedIngredientLine {
  const trimmed = normalizeFractions(text.trim());

  const amountMatch = trimmed.match(LEADING_AMOUNT);
  if (!amountMatch) {
    // ponytail: keine Menge erkannt (z.B. "Salz nach Geschmack") → amount=1 als
    // neutraler Default, kein Raten der eigentlichen Menge.
    return { amount: 1, unit: null, ...extractParenthetical(trimmed) };
  }

  const amount = parseFloat(amountMatch[1].replace(",", "."));
  const remainder = trimmed.slice(amountMatch[0].length);

  const wordMatch = remainder.match(FIRST_WORD);
  if (!wordMatch) {
    return { amount, unit: null, ...extractParenthetical(remainder) };
  }

  const [, firstWord, rest] = wordMatch;
  if (isKnownUnitWord(firstWord)) {
    return { amount, unit: firstWord, ...extractParenthetical(rest) };
  }

  return { amount, unit: null, ...extractParenthetical(remainder) };
}
