import { isKnownUnitWord } from "../units/convert.ts";

export type ParsedIngredientLine = {
  amount: number;
  unit: string | null;
  name: string;
};

const LEADING_AMOUNT = /^(\d+(?:[.,]\d+)?)\s*/;
const FIRST_WORD = /^(\S+)\s*(.*)$/;

// Regex-Split einer freien Zutatenzeile nach docs/05-modul-rezepte.md Schritt 1:
// Menge → optionales Einheiten-Wort (Alias-Tabelle aus convert.ts) → Rest = Name.
export function parseIngredientLine(text: string): ParsedIngredientLine {
  const trimmed = text.trim();

  const amountMatch = trimmed.match(LEADING_AMOUNT);
  if (!amountMatch) {
    // ponytail: keine Menge erkannt (z.B. "Salz nach Geschmack") → amount=1 als
    // neutraler Default, kein Raten der eigentlichen Menge.
    return { amount: 1, unit: null, name: trimmed };
  }

  const amount = parseFloat(amountMatch[1].replace(",", "."));
  const remainder = trimmed.slice(amountMatch[0].length);

  const wordMatch = remainder.match(FIRST_WORD);
  if (!wordMatch) {
    return { amount, unit: null, name: remainder };
  }

  const [, firstWord, rest] = wordMatch;
  if (isKnownUnitWord(firstWord)) {
    return { amount, unit: firstWord, name: rest.trim() };
  }

  return { amount, unit: null, name: remainder.trim() };
}
