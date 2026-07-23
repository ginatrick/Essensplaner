// Deklarative Regel-Definition für die Wochen-Ampel (docs/09-modul-ernaehrung.md).
// Als TS-Konstante statt .json: JSON-Imports brauchen unter nativer Node-ESM-
// Ausführung (npm test, node --test) Import-Attribute ("with { type: 'json' }"),
// unter Next.js/Turbopack dagegen nicht — uneinheitlich zwischen den beiden
// Laufzeiten, die dieses Projekt nutzt. Eine typisierte Konstante ist genauso
// deklarativ, ohne die Reibung.
//
// Die Ampel bewertet Nährstoffe, nicht Gerichtekategorien: gezählt wird, an wie
// vielen Tagen eine Portion den Richtwert erreicht — errechnet aus den
// Zutatenmengen. Tag-Kriterien bleiben nur dort, wo es um Lebensmittelqualität
// geht, die sich aus Nährwerten nicht ableiten lässt (rotes Fleisch,
// Fertigprodukte).
//
// Die Richtwerte gelten je Portion einer Hauptmahlzeit und sind bewusst als
// Plan-Ziele formuliert, nicht als Bedarf einer bestimmten Person — docs/13
// untersagt Personenbilanzen, insbesondere für die Kinder.

export type NutrientField = "protein_100" | "fiber_100" | "iron_mg_100" | "calcium_mg_100";

export type Criterion = {
  id: string;
  label: string;
  /** Einheit des Richtwerts, nur für die Anzeige/Begründung. */
  unit?: string;
} & (
  | { kind: "tag"; tags: string[]; direction: "min"; green: number; yellow: number }
  | { kind: "tag"; tags: string[]; direction: "max"; green: number; yellow: number }
  | { kind: "tag"; tags: string[]; direction: "range"; greenMin: number; greenMax: number; redAbove: number }
  | { kind: "nutrient"; field: NutrientField; minPerPortion: number; direction: "min"; green: number; yellow: number }
);

export const NUTRITION_RULES: Criterion[] = [
  { id: "protein", label: "Protein", unit: "g", kind: "nutrient", field: "protein_100", minPerPortion: 20, direction: "min", green: 5, yellow: 3 },
  { id: "fiber", label: "Ballaststoffe", unit: "g", kind: "nutrient", field: "fiber_100", minPerPortion: 7, direction: "min", green: 5, yellow: 3 },
  { id: "iron", label: "Eisen", unit: "mg", kind: "nutrient", field: "iron_mg_100", minPerPortion: 2.5, direction: "min", green: 4, yellow: 2 },
  { id: "calcium", label: "Calcium", unit: "mg", kind: "nutrient", field: "calcium_mg_100", minPerPortion: 150, direction: "min", green: 4, yellow: 2 },
  // Qualitätsregeln: nicht aus Nährwerten ableitbar, daher weiter tag-basiert.
  { id: "redmeat", label: "Rotes Fleisch", kind: "tag", tags: ["rind", "schwein", "lamm"], direction: "max", green: 2, yellow: 3 },
  { id: "fried", label: "Frittiert / Fertigprodukt", kind: "tag", tags: ["frittiert", "fertigprodukt"], direction: "max", green: 1, yellow: 2 },
];
