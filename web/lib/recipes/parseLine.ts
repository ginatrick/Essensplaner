import { isKnownUnitWord } from "../units/convert.ts";

export type ParsedIngredientLine = {
  amount: number;
  unit: string | null;
  name: string;
};

const LEADING_AMOUNT = /^(\d+(?:[.,]\d+)?)\s*/;
const FIRST_WORD = /^(\S+)\s*(.*)$/;
// Klammer-Zusätze wie "(à 140 g Abtropfgewicht)", "(gehackt)" sind
// Verpackungs-/Zubereitungshinweise, kein Teil des Zutatennamens — würden die
// Alias-/Fuzzy-Suche sonst leer laufen lassen (sucht nach dem ganzen Text
// inkl. Klammer statt nach "Mais").
const PARENTHETICAL = /\s*\([^)]*\)/g;

function stripParenthetical(value: string): string {
  return value.replace(PARENTHETICAL, "").replace(/\s+/g, " ").trim();
}

// Regex-Split einer freien Zutatenzeile nach docs/05-modul-rezepte.md Schritt 1:
// Menge → optionales Einheiten-Wort (Alias-Tabelle aus convert.ts) → Rest = Name.
export function parseIngredientLine(text: string): ParsedIngredientLine {
  const trimmed = text.trim();

  const amountMatch = trimmed.match(LEADING_AMOUNT);
  if (!amountMatch) {
    // ponytail: keine Menge erkannt (z.B. "Salz nach Geschmack") → amount=1 als
    // neutraler Default, kein Raten der eigentlichen Menge.
    return { amount: 1, unit: null, name: stripParenthetical(trimmed) };
  }

  const amount = parseFloat(amountMatch[1].replace(",", "."));
  const remainder = trimmed.slice(amountMatch[0].length);

  const wordMatch = remainder.match(FIRST_WORD);
  if (!wordMatch) {
    return { amount, unit: null, name: stripParenthetical(remainder) };
  }

  const [, firstWord, rest] = wordMatch;
  if (isKnownUnitWord(firstWord)) {
    return { amount, unit: firstWord, name: stripParenthetical(rest) };
  }

  return { amount, unit: null, name: stripParenthetical(remainder) };
}
