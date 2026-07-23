// Wochen-Ampel-Evaluator (docs/09-modul-ernaehrung.md). Deterministisch,
// kein LLM — bewertet den Plan, nicht die einzelne Portion. Reine Funktion,
// kein DB-/UI-Bezug; der Aufrufer lädt tags + Zutatenmengen mit Nährwerten.

import { dayLabel } from "./week.ts";
import { NUTRITION_RULES, type Criterion, type NutrientField } from "./nutrition_rules.ts";

export type NutritionIngredient = {
  amount: number;
  /** Basiseinheit der gespeicherten Menge: g, ml oder stk. */
  unit: string;
  /** Für stückweise Mengen ("2 Eier"); ohne Wert lässt sich die Zeile nicht wiegen. */
  piece_weight_g?: number | null;
  density_g_ml?: number | null;
  protein_100?: number | null;
  fiber_100?: number | null;
  iron_mg_100?: number | null;
  calcium_mg_100?: number | null;
};

export type NutritionEntry = {
  day: number;
  tags: string[] | null;
  /** Portionen, auf die sich die Zutatenmengen beziehen. */
  servings: number;
  ingredients: NutritionIngredient[];
};

export type Ampel = "gruen" | "gelb" | "rot";

export type CriterionResult = {
  id: string;
  label: string;
  /** Anzahl Tage, die das Kriterium erfüllen (bzw. bei "max" verletzen). */
  count: number;
  ampel: Ampel;
  suggestion: string | null;
  /** Nur bei Nährstoff-Kriterien: Durchschnitt je Portion über alle Tage. */
  averagePerPortion?: number;
  /** Einheit zu averagePerPortion (g, mg). */
  unit?: string;
};

export type WeekAmpel = {
  overall: Ampel;
  criteria: CriterionResult[];
};

const AMPEL_RANK: Record<Ampel, number> = { gruen: 0, gelb: 1, rot: 2 };

function worstAmpel(values: Ampel[]): Ampel {
  return values.reduce((worst, v) => (AMPEL_RANK[v] > AMPEL_RANK[worst] ? v : worst), "gruen" as Ampel);
}

// Gewicht einer Zutatenzeile in Gramm — Bezugsgröße für alle Nährwerte, die
// je 100 g hinterlegt sind. Ohne bekanntes Gewicht (stk ohne piece_weight_g)
// steuert die Zeile 0 bei: lieber unterschätzen als eine Zahl erfinden.
function gramsOf(ing: NutritionIngredient): number {
  if (ing.unit === "g") return ing.amount;
  if (ing.unit === "ml") return ing.amount * (ing.density_g_ml ?? 1);
  if (ing.unit === "stk" && ing.piece_weight_g) return ing.amount * ing.piece_weight_g;
  return 0;
}

// Nährstoffmenge einer Mahlzeit je Portion.
export function nutrientPerPortion(entry: NutritionEntry, field: NutrientField): number {
  const total = entry.ingredients.reduce(
    (sum, ing) => sum + (gramsOf(ing) / 100) * (ing[field] ?? 0),
    0,
  );
  const servings = entry.servings > 0 ? entry.servings : 1;
  return total / servings;
}

function matchesCriterion(rule: Criterion, entry: NutritionEntry): boolean {
  if (rule.kind === "tag") {
    if (!entry.tags) return false;
    return entry.tags.some((t) => rule.tags.some((needle) => t.toLowerCase().includes(needle)));
  }
  return nutrientPerPortion(entry, rule.field) >= rule.minPerPortion;
}

function ampelFor(rule: Criterion, count: number): Ampel {
  if (rule.direction === "min") {
    if (count >= rule.green) return "gruen";
    if (count >= rule.yellow) return "gelb";
    return "rot";
  }
  if (rule.direction === "max") {
    if (count <= rule.green) return "gruen";
    if (count <= rule.yellow) return "gelb";
    return "rot";
  }
  // range
  if (count >= rule.greenMin && count <= rule.greenMax) return "gruen";
  if (count === 0 || count > rule.redAbove) return "rot";
  return "gelb";
}

function dayList(days: number[]): string {
  return days.map(dayLabel).join(", ");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function suggestionFor(
  rule: Criterion,
  count: number,
  matchedDays: number[],
  allDays: number[],
): string | null {
  const nonMatchedDays = allDays.filter((d) => !matchedDays.includes(d));

  if (rule.kind === "nutrient") {
    return `Rot: nur an ${count} Tag(en) erreicht eine Portion ${rule.minPerPortion} ${rule.unit} ${rule.label} ` +
      `(Ziel ≥ ${rule.green} Tage). Ergänze an einem dieser Tage eine reichere Beilage: ${dayList(nonMatchedDays)}.`;
  }
  if (rule.direction === "min") {
    return `Rot: nur ${count} ${rule.label}-Gericht(e) diese Woche (Ziel ≥ ${rule.green}). ` +
      `Ergänze eins, z. B. an einem der Tage: ${dayList(nonMatchedDays)}.`;
  }
  if (rule.direction === "max") {
    return `Rot: ${count} ${rule.label}-Gerichte diese Woche (Ziel ≤ ${rule.green}). ` +
      `Ersetze eins an einem dieser Tage durch eine leichtere Variante: ${dayList(matchedDays)}.`;
  }
  // range
  if (count === 0) {
    return `Rot: kein ${rule.label}-Gericht diese Woche (Ziel ${rule.greenMin}–${rule.greenMax}). ` +
      `Ergänze eins, z. B. an einem der Tage: ${dayList(nonMatchedDays)}.`;
  }
  return `Rot: ${count} ${rule.label}-Gerichte diese Woche (Ziel ${rule.greenMin}–${rule.greenMax}). ` +
    `Reduziere auf höchstens ${rule.redAbove}, ersetze eins an einem dieser Tage: ${dayList(matchedDays)}.`;
}

function evaluateCriterion(rule: Criterion, entries: NutritionEntry[]): CriterionResult {
  const matchedDays = entries.filter((e) => matchesCriterion(rule, e)).map((e) => e.day);
  const count = matchedDays.length;
  const ampel = ampelFor(rule, count);
  const allDays = entries.map((e) => e.day);
  return {
    id: rule.id,
    label: rule.label,
    count,
    ampel,
    suggestion: ampel === "rot" ? suggestionFor(rule, count, matchedDays, allDays) : null,
    ...(rule.kind === "nutrient"
      ? {
          averagePerPortion: round(entries.reduce((s, e) => s + nutrientPerPortion(e, rule.field), 0) / entries.length),
          unit: rule.unit,
        }
      : {}),
  };
}

export function evaluateWeek(entries: NutritionEntry[]): WeekAmpel {
  if (entries.length === 0) {
    return { overall: "gelb", criteria: NUTRITION_RULES.map((r) => ({ id: r.id, label: r.label, count: 0, ampel: "gelb", suggestion: null })) };
  }
  const criteria = NUTRITION_RULES.map((rule) => evaluateCriterion(rule, entries));
  return { overall: worstAmpel(criteria.map((c) => c.ampel)), criteria };
}
