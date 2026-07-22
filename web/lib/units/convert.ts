export type BaseUnit = "g" | "ml" | "stk";

type ConversionRule =
  | { kind: "linear"; factor: number; unit: "g" | "ml" }
  | { kind: "stk" };

// Aliase nach docs/05-modul-rezepte.md: EL=15ml · TL=5ml · Prise=0.5g.
// Stückgut (Bund/Zehe/Stück/Dose/Packung) hat kein Referenzgewicht in diesem
// Schritt und wird nur auf unit='stk' durchgereicht, amount unverändert.
const UNIT_ALIASES: Record<string, ConversionRule> = {
  // Gewicht
  g: { kind: "linear", factor: 1, unit: "g" },
  gramm: { kind: "linear", factor: 1, unit: "g" },
  gr: { kind: "linear", factor: 1, unit: "g" },
  kg: { kind: "linear", factor: 1000, unit: "g" },
  kilogramm: { kind: "linear", factor: 1000, unit: "g" },

  // Volumen
  ml: { kind: "linear", factor: 1, unit: "ml" },
  milliliter: { kind: "linear", factor: 1, unit: "ml" },
  l: { kind: "linear", factor: 1000, unit: "ml" },
  liter: { kind: "linear", factor: 1000, unit: "ml" },
  cl: { kind: "linear", factor: 10, unit: "ml" },
  zentiliter: { kind: "linear", factor: 10, unit: "ml" },

  // Löffel/Prise
  el: { kind: "linear", factor: 15, unit: "ml" },
  essl: { kind: "linear", factor: 15, unit: "ml" },
  esslöffel: { kind: "linear", factor: 15, unit: "ml" },
  tl: { kind: "linear", factor: 5, unit: "ml" },
  teel: { kind: "linear", factor: 5, unit: "ml" },
  teelöffel: { kind: "linear", factor: 5, unit: "ml" },
  prise: { kind: "linear", factor: 0.5, unit: "g" },
  prisen: { kind: "linear", factor: 0.5, unit: "g" },

  // Stückgut
  bund: { kind: "stk" },
  bünde: { kind: "stk" },
  zehe: { kind: "stk" },
  zehen: { kind: "stk" },
  stück: { kind: "stk" },
  stk: { kind: "stk" },
  "stk.": { kind: "stk" },
  st: { kind: "stk" },
  dose: { kind: "stk" },
  dosen: { kind: "stk" },
  packung: { kind: "stk" },
  packungen: { kind: "stk" },
};

// Wiederverwendet vom Zutaten-Parser (web/lib/recipes), damit Einheiten-Erkennung
// nur an einer Stelle gepflegt wird.
export function isKnownUnitWord(word: string): boolean {
  return word.trim().toLowerCase() in UNIT_ALIASES;
}

export function toBaseUnit(input: {
  amount: number;
  unit: string;
}): { amount: number; unit: BaseUnit } {
  const key = input.unit.trim().toLowerCase();
  const rule = UNIT_ALIASES[key];

  if (!rule) {
    throw new Error(`Unbekannte Einheit: "${input.unit}"`);
  }

  if (rule.kind === "stk") {
    return { amount: input.amount, unit: "stk" };
  }

  return { amount: input.amount * rule.factor, unit: rule.unit };
}
