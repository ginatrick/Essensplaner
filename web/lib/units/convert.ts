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

// toBaseUnit kennt nur die Einheit im Rezepttext, nicht die Zutat — "1 TL Salz"
// wird zu 5 ml, obwohl Salz in ingredients in g geführt wird. Die
// Einkaufslisten-Aggregation summiert aber stumpf pro Zutat und würde so ml zu
// g addieren. Diese Funktion zieht das Ergebnis auf die Basiseinheit der Zutat.
//
// Ohne density_g_ml wird 1 ml = 1 g angenommen (Wasser-Näherung, in der Küche
// für kleine Mengen üblich). Für Trockenes wie Zimt liegt sie zu hoch —
// ponytail: bewusst grob, sauber wird es erst mit gepflegten Dichten.
// stk lässt sich ohne Stückgewicht nicht umrechnen und bleibt unverändert.
export function toIngredientBaseUnit(
  input: { amount: number; unit: string },
  ingredient: { base_unit: string; density_g_ml?: number | null },
): { amount: number; unit: BaseUnit } {
  const converted = toBaseUnit(input);
  const target = ingredient.base_unit;
  if (converted.unit === target || target === "stk" || converted.unit === "stk") return converted;

  const density = ingredient.density_g_ml ?? 1;
  if (converted.unit === "ml" && target === "g") return { amount: converted.amount * density, unit: "g" };
  if (converted.unit === "g" && target === "ml") return { amount: converted.amount / density, unit: "ml" };
  return converted;
}
