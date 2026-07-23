// Wochen-Ampel-Evaluator (docs/09-modul-ernaehrung.md). Deterministisch,
// kein LLM — bewertet den Plan, nicht die einzelne Portion. Reine Funktion,
// kein DB-/UI-Bezug; der Aufrufer lädt tags + Ingredient-Nährwerte.

import { dayLabel } from "./week.ts";
import { NUTRITION_RULES, type Criterion } from "./nutrition_rules.ts";

export type NutritionEntry = {
  day: number;
  tags: string[] | null;
  ingredientNutrients: { iron_mg_100: number | null; calcium_mg_100: number | null }[];
};

export type Ampel = "gruen" | "gelb" | "rot";

export type CriterionResult = {
  id: string;
  label: string;
  count: number;
  ampel: Ampel;
  suggestion: string | null;
};

export type WeekAmpel = {
  overall: Ampel;
  criteria: CriterionResult[];
};

const AMPEL_RANK: Record<Ampel, number> = { gruen: 0, gelb: 1, rot: 2 };

function worstAmpel(values: Ampel[]): Ampel {
  return values.reduce((worst, v) => (AMPEL_RANK[v] > AMPEL_RANK[worst] ? v : worst), "gruen" as Ampel);
}

function matchesCriterion(rule: Criterion, entry: NutritionEntry): boolean {
  if (rule.kind === "tag") {
    if (!entry.tags) return false;
    return entry.tags.some((t) => rule.tags.some((needle) => t.toLowerCase().includes(needle)));
  }
  return entry.ingredientNutrients.some((n) => (n[rule.field] ?? 0) >= rule.minValue);
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

function suggestionFor(rule: Criterion, count: number, matchedDays: number[], allDays: number[]): string | null {
  const nonMatchedDays = allDays.filter((d) => !matchedDays.includes(d));

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
  };
}

export function evaluateWeek(entries: NutritionEntry[]): WeekAmpel {
  if (entries.length === 0) {
    return { overall: "gelb", criteria: NUTRITION_RULES.map((r) => ({ id: r.id, label: r.label, count: 0, ampel: "gelb", suggestion: null })) };
  }
  const criteria = NUTRITION_RULES.map((rule) => evaluateCriterion(rule, entries));
  return { overall: worstAmpel(criteria.map((c) => c.ampel)), criteria };
}
