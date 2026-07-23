import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { filterCandidatePool } from "./candidates.ts";
import type { CandidateRecipe } from "./types.ts";

function recipe(overrides: Partial<CandidateRecipe>): CandidateRecipe {
  return {
    id: "r1", title: "Test", tags: [], prep_min: 10, cook_min: 10, is_experimental: false,
    lastPlanned: null, tasteScore: null, mainIngredientId: null, inSeason: true, servings: 4, ingredients: [],
    ...overrides,
  };
}

const TODAY = new Date("2026-07-23T00:00:00Z");

describe("filterCandidatePool", () => {
  test("nie geplant -> im Pool", () => {
    const result = filterCandidatePool([recipe({ lastPlanned: null })], TODAY);
    assert.equal(result.length, 1);
  });

  test("vor > 14 Tagen geplant -> im Pool", () => {
    const result = filterCandidatePool([recipe({ lastPlanned: "2026-07-01" })], TODAY);
    assert.equal(result.length, 1);
  });

  test("vor <= 14 Tagen geplant -> raus", () => {
    const result = filterCandidatePool([recipe({ lastPlanned: "2026-07-15" })], TODAY);
    assert.equal(result.length, 0);
  });

  test("taste_score <= -0.3 -> raus", () => {
    const result = filterCandidatePool([recipe({ tasteScore: -0.5 })], TODAY);
    assert.equal(result.length, 0);
  });

  test("taste_score unbekannt (null) -> im Pool (funktioniert auch für nie geplante Gerichte)", () => {
    const result = filterCandidatePool([recipe({ tasteScore: null })], TODAY);
    assert.equal(result.length, 1);
  });

  test("außerhalb Saison -> raus", () => {
    const result = filterCandidatePool([recipe({ inSeason: false })], TODAY);
    assert.equal(result.length, 0);
  });
});
