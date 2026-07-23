import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { solveWeek } from "./solver.ts";
import type { CandidateRecipe } from "./types.ts";

function recipe(id: string, overrides: Partial<CandidateRecipe> = {}): CandidateRecipe {
  return {
    id, title: id, tags: [], prep_min: 10, cook_min: 10, is_experimental: false,
    lastPlanned: null, tasteScore: 0.5, mainIngredientId: null, inSeason: true, ingredientNutrients: [],
    ...overrides,
  };
}

function alwaysZero() { return 0; }

describe("solveWeek", () => {
  test("füllt bis zu 7 Tage, keine Wiederholung desselben Rezepts", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => recipe(`r${i}`, { tasteScore: i }));
    const slots = solveWeek(candidates, { random: alwaysZero });
    assert.equal(slots.length, 7);
    assert.equal(new Set(slots.map((s) => s.recipe.id)).size, 7);
  });

  test("bevorzugt höheren taste_score außerhalb der Exploration-Slots", () => {
    const candidates = [recipe("low", { tasteScore: 0.1 }), recipe("high", { tasteScore: 0.9 })];
    // 0 Exploration-Slots erzwingen, damit der Test nur die Score-Präferenz prüft.
    const slots = solveWeek(candidates, { random: alwaysZero, explorationRate: 0 });
    assert.equal(slots[0]!.recipe.id, "high");
  });

  test("max. 2 Gerichte mit gleicher Hauptzutat pro Woche", () => {
    const candidates = Array.from({ length: 7 }, (_, i) => recipe(`r${i}`, { mainIngredientId: "haehnchen", tasteScore: i }));
    const slots = solveWeek(candidates, { random: alwaysZero });
    const haehnchenCount = slots.filter((s) => s.recipe.mainIngredientId === "haehnchen").length;
    assert.ok(haehnchenCount <= 2);
  });

  test("Trainingstage: nur Rezepte mit prep+cook <= 40 min", () => {
    const candidates = [
      recipe("schnell", { prep_min: 10, cook_min: 20, tasteScore: 0.1 }),
      recipe("aufwendig", { prep_min: 30, cook_min: 40, tasteScore: 0.9 }),
    ];
    const slots = solveWeek(candidates, { random: alwaysZero, trainingDays: [0], explorationRate: 0 });
    const dayZero = slots.find((s) => s.day === 0);
    assert.equal(dayZero?.recipe.id, "schnell");
  });

  test("Trainingstage: kein is_experimental Rezept (docs/09 'kein Rezept am Spieltag')", () => {
    const candidates = [
      recipe("normal", { prep_min: 10, cook_min: 10, tasteScore: 0.1, is_experimental: false }),
      recipe("experimentell", { prep_min: 10, cook_min: 10, tasteScore: 0.9, is_experimental: true }),
    ];
    const slots = solveWeek(candidates, { random: alwaysZero, trainingDays: [0], explorationRate: 0 });
    assert.equal(slots.find((s) => s.day === 0)?.recipe.id, "normal");
  });

  test("mind. 1 Exploration-Slot bei explorationRate=0.2 (7 Tage)", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => recipe(`r${i}`));
    const slots = solveWeek(candidates, { random: alwaysZero, explorationRate: 0.2 });
    assert.ok(slots.some((s) => s.isExploration));
  });

  test("kein Kandidat für einen Tag -> Slot bleibt leer, kein Crash", () => {
    const slots = solveWeek([], { random: alwaysZero });
    assert.equal(slots.length, 0);
  });
});
