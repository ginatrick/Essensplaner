// Deklarative Regel-Definition für die Wochen-Ampel (docs/09-modul-ernaehrung.md).
// Als TS-Konstante statt .json: JSON-Imports brauchen unter nativer Node-ESM-
// Ausführung (npm test, node --test) Import-Attribute ("with { type: 'json' }"),
// unter Next.js/Turbopack dagegen nicht — uneinheitlich zwischen den beiden
// Laufzeiten, die dieses Projekt nutzt. Eine typisierte Konstante ist genauso
// deklarativ, ohne die Reibung.

export type Criterion = {
  id: string;
  label: string;
} & (
  | { kind: "tag"; tags: string[]; direction: "min"; green: number; yellow: number }
  | { kind: "tag"; tags: string[]; direction: "max"; green: number; yellow: number }
  | { kind: "tag"; tags: string[]; direction: "range"; greenMin: number; greenMax: number; redAbove: number }
  | { kind: "nutrient"; field: "iron_mg_100" | "calcium_mg_100"; minValue: number; direction: "min"; green: number; yellow: number }
);

export const NUTRITION_RULES: Criterion[] = [
  { id: "vegetable", label: "Gemüse-/Obstgerichte", kind: "tag", tags: ["gemüse", "obst", "salat"], direction: "min", green: 5, yellow: 3 },
  { id: "wholegrain", label: "Vollkorn / komplexe KH", kind: "tag", tags: ["vollkorn"], direction: "min", green: 4, yellow: 2 },
  { id: "legume", label: "Hülsenfrüchte", kind: "tag", tags: ["hülsenfrucht", "linsen", "kichererbsen", "bohnen"], direction: "min", green: 2, yellow: 1 },
  { id: "fish", label: "Fisch", kind: "tag", tags: ["fisch"], direction: "range", greenMin: 1, greenMax: 2, redAbove: 3 },
  { id: "redmeat", label: "Rotes Fleisch", kind: "tag", tags: ["rind", "schwein", "lamm"], direction: "max", green: 2, yellow: 3 },
  { id: "fried", label: "Frittiert / Fertigprodukt", kind: "tag", tags: ["frittiert", "fertigprodukt"], direction: "max", green: 1, yellow: 2 },
  { id: "iron", label: "Eisenquellen", kind: "nutrient", field: "iron_mg_100", minValue: 2, direction: "min", green: 4, yellow: 2 },
  { id: "calcium", label: "Calciumquellen", kind: "nutrient", field: "calcium_mg_100", minValue: 100, direction: "min", green: 5, yellow: 3 },
];
