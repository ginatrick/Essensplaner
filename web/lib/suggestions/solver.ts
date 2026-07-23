// Auswahl, Schritt 2 aus docs/10-modul-lernen.md: greedy Constraint-Solver
// (kein volles CSP/Backtracking — die Woche geht danach in die normale
// Planbearbeitung, wo die Wochen-Ampel (Phase 6) live weiterhilft, falls das
// Ergebnis nicht schon grün ist. "Ziel: grün" wird damit iterativ erreicht,
// nicht zwingend im ersten Wurf).

import type { CandidateRecipe, SuggestedSlot } from "./types.ts";

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const MAX_SAME_MAIN_INGREDIENT = 2;
const TRAINING_DAY_MAX_MINUTES = 40;

export type SolverOptions = {
  trainingDays: number[];
  explorationRate: number;
  random: () => number;
};

function effortMinutes(r: CandidateRecipe): number {
  return (r.prep_min ?? 0) + (r.cook_min ?? 0);
}

function pickRandomDays(days: number[], count: number, random: () => number): number[] {
  const pool = [...days];
  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

export function solveWeek(candidates: CandidateRecipe[], options: Partial<SolverOptions> = {}): SuggestedSlot[] {
  const trainingDays = new Set(options.trainingDays ?? []);
  const explorationRate = options.explorationRate ?? 0.2;
  const random = options.random ?? Math.random;

  const explorationSlotCount =
    explorationRate <= 0 ? 0 : Math.max(1, Math.min(2, Math.round(DAYS.length * explorationRate)));
  const explorationDays = new Set(pickRandomDays(DAYS, explorationSlotCount, random));

  const used: CandidateRecipe[] = [];
  const mainIngredientCounts = new Map<string, number>();
  const slots: SuggestedSlot[] = [];

  for (const day of DAYS) {
    const isExploration = explorationDays.has(day);
    const eligible = candidates.filter((r) => {
      if (used.includes(r)) return false;
      if (trainingDays.has(day) && effortMinutes(r) > TRAINING_DAY_MAX_MINUTES) return false;
      // docs/09-modul-ernaehrung.md: "Spieltag: kein is_experimental Rezept" —
      // Trainingstage sind der einzige uns bekannte Näherungswert für Spieltage.
      if (trainingDays.has(day) && r.is_experimental) return false;
      if (r.mainIngredientId && (mainIngredientCounts.get(r.mainIngredientId) ?? 0) >= MAX_SAME_MAIN_INGREDIENT) return false;
      return true;
    });
    if (eligible.length === 0) continue; // Kein Kandidat für diesen Tag -> Slot bleibt leer, kein Crash.

    let pick: CandidateRecipe;
    if (isExploration) {
      const unknown = eligible.filter((r) => r.tasteScore === null);
      const pool = unknown.length > 0 ? unknown : eligible;
      pick = pool[Math.floor(random() * pool.length)]!;
    } else {
      pick = [...eligible].sort((a, b) => (b.tasteScore ?? 0) - (a.tasteScore ?? 0))[0]!;
    }

    used.push(pick);
    if (pick.mainIngredientId) {
      mainIngredientCounts.set(pick.mainIngredientId, (mainIngredientCounts.get(pick.mainIngredientId) ?? 0) + 1);
    }
    slots.push({ day, recipe: pick, isExploration });
  }

  return slots;
}
