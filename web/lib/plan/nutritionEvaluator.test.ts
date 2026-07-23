import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { evaluateWeek, type NutritionEntry } from "./nutritionEvaluator.ts";

function entry(day: number, tags: string[] | null, nutrients: { iron_mg_100?: number; calcium_mg_100?: number }[] = []): NutritionEntry {
  return {
    day,
    tags,
    ingredientNutrients: nutrients.map((n) => ({ iron_mg_100: n.iron_mg_100 ?? null, calcium_mg_100: n.calcium_mg_100 ?? null })),
  };
}

describe("evaluateWeek", () => {
  test("leere Woche -> gelb, kein Crash", () => {
    const result = evaluateWeek([]);
    assert.equal(result.overall, "gelb");
    assert.equal(result.criteria.every((c) => c.ampel === "gelb"), true);
  });

  test("Hülsenfrüchte: 2 Treffer -> grün, kein Tauschvorschlag", () => {
    const entries = [
      entry(0, ["hülsenfrucht"]),
      entry(1, ["hülsenfrucht"]),
      entry(2, []),
    ];
    const result = evaluateWeek(entries);
    const legume = result.criteria.find((c) => c.id === "legume")!;
    assert.equal(legume.ampel, "gruen");
    assert.equal(legume.suggestion, null);
  });

  test("Hülsenfrüchte: 0 Treffer -> rot mit Tauschvorschlag, nennt freie Tage", () => {
    const entries = [entry(0, ["fleisch"]), entry(1, ["fleisch"])];
    const result = evaluateWeek(entries);
    const legume = result.criteria.find((c) => c.id === "legume")!;
    assert.equal(legume.ampel, "rot");
    assert.match(legume.suggestion!, /Mo, Di/);
  });

  test("Fisch: 0 -> rot (leere Range), 1 -> grün, 4 -> rot (über redAbove)", () => {
    assert.equal(evaluateWeek([entry(0, [])]).criteria.find((c) => c.id === "fish")!.ampel, "rot");
    assert.equal(evaluateWeek([entry(0, ["fisch"])]).criteria.find((c) => c.id === "fish")!.ampel, "gruen");
    const manyFish = [0, 1, 2, 3].map((d) => entry(d, ["fisch"]));
    assert.equal(evaluateWeek(manyFish).criteria.find((c) => c.id === "fish")!.ampel, "rot");
  });

  test("Eisenquellen: Nährwert-basiert, nicht tag-basiert", () => {
    const entries = [
      entry(0, [], [{ iron_mg_100: 3 }]),
      entry(1, [], [{ iron_mg_100: 0.1 }]),
    ];
    const result = evaluateWeek(entries);
    const iron = result.criteria.find((c) => c.id === "iron")!;
    assert.equal(iron.count, 1);
  });

  test("Gesamtampel ist das schlechteste Kriterium", () => {
    // Alles rot bis auf ein Kriterium mit vielen Treffern -> Overall bleibt rot.
    const entries = [entry(0, ["gemüse", "vollkorn"]), entry(1, ["gemüse"])];
    const result = evaluateWeek(entries);
    assert.equal(result.overall, "rot");
  });
});
