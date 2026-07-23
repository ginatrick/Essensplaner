// Kandidatenpool, Schritt 1 aus docs/10-modul-lernen.md: rein deterministisches
// SQL-Äquivalent-Filtern in TS (die eigentlichen DB-Queries lädt der Aufrufer,
// hier nur die reine Filterlogik, testbar ohne DB).

import type { CandidateRecipe } from "./types.ts";

const MIN_DAYS_SINCE_PLANNED = 14;
const MIN_TASTE_SCORE = -0.3;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function filterCandidatePool(recipes: CandidateRecipe[], today: Date): CandidateRecipe[] {
  return recipes.filter((r) => {
    const longEnoughAgo = r.lastPlanned === null || daysBetween(today, new Date(r.lastPlanned)) > MIN_DAYS_SINCE_PLANNED;
    const tasteOk = r.tasteScore === null || r.tasteScore > MIN_TASTE_SCORE;
    return longEnoughAgo && tasteOk && r.inSeason;
  });
}
