import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { evaluateWeek, nutrientPerPortion, type NutritionEntry, type NutritionIngredient } from "./nutritionEvaluator.ts";

function entry(
  day: number,
  tags: string[] | null,
  ingredients: Partial<NutritionIngredient>[] = [],
  servings = 4,
): NutritionEntry {
  return {
    day,
    tags,
    servings,
    ingredients: ingredients.map((i) => ({ amount: 0, unit: "g", ...i })),
  };
}

// 400 g einer Zutat mit 25 g Protein/100 g = 100 g Protein, auf 4 Portionen
// verteilt also 25 g je Portion — über dem Richtwert von 20 g.
const proteinRich = { amount: 400, unit: "g", protein_100: 25 };
const proteinPoor = { amount: 100, unit: "g", protein_100: 1 };

describe("nutrientPerPortion", () => {
  test("rechnet Nährwert je 100 g auf die tatsächliche Menge und Portionen um", () => {
    const e = entry(0, [], [proteinRich]);
    assert.equal(nutrientPerPortion(e, "protein_100"), 25);
  });

  test("ml wird über die Dichte gewogen", () => {
    const e = entry(0, [], [{ amount: 1000, unit: "ml", density_g_ml: 0.5, protein_100: 10 }], 1);
    // 1000 ml x 0.5 = 500 g -> 50 g Protein
    assert.equal(nutrientPerPortion(e, "protein_100"), 50);
  });

  test("stk zählt über das Stückgewicht", () => {
    const e = entry(0, [], [{ amount: 2, unit: "stk", piece_weight_g: 55, protein_100: 13 }], 1);
    // 2 x 55 g = 110 g -> 14.3 g Protein
    assert.equal(Math.round(nutrientPerPortion(e, "protein_100") * 10) / 10, 14.3);
  });

  test("stk ohne Stückgewicht steuert 0 bei, statt eine Zahl zu erfinden", () => {
    const e = entry(0, [], [{ amount: 2, unit: "stk", protein_100: 13 }], 1);
    assert.equal(nutrientPerPortion(e, "protein_100"), 0);
  });

  test("servings=0 wird nicht zur Division durch null", () => {
    const e = entry(0, [], [proteinRich], 0);
    assert.equal(Number.isFinite(nutrientPerPortion(e, "protein_100")), true);
  });
});

describe("evaluateWeek", () => {
  test("leere Woche -> gelb, kein Crash", () => {
    const result = evaluateWeek([]);
    assert.equal(result.overall, "gelb");
    assert.equal(result.criteria.every((c) => c.ampel === "gelb"), true);
  });

  test("Protein: zählt Tage, an denen die Portion den Richtwert erreicht", () => {
    const entries = [
      entry(0, [], [proteinRich]),
      entry(1, [], [proteinRich]),
      entry(2, [], [proteinPoor]),
    ];
    const protein = evaluateWeek(entries).criteria.find((c) => c.id === "protein")!;
    assert.equal(protein.count, 2);
  });

  test("Protein: 5 gute Tage -> grün ohne Tauschvorschlag", () => {
    const entries = [0, 1, 2, 3, 4].map((d) => entry(d, [], [proteinRich]));
    const protein = evaluateWeek(entries).criteria.find((c) => c.id === "protein")!;
    assert.equal(protein.ampel, "gruen");
    assert.equal(protein.suggestion, null);
  });

  test("Protein: zu wenige Tage -> rot, Vorschlag nennt die schwachen Tage", () => {
    const entries = [entry(0, [], [proteinPoor]), entry(1, [], [proteinPoor])];
    const protein = evaluateWeek(entries).criteria.find((c) => c.id === "protein")!;
    assert.equal(protein.ampel, "rot");
    assert.match(protein.suggestion!, /Mo, Di/);
    assert.match(protein.suggestion!, /20 g Protein/);
  });

  test("meldet den Durchschnitt je Portion zurück", () => {
    const entries = [entry(0, [], [proteinRich]), entry(1, [], [proteinPoor])];
    const protein = evaluateWeek(entries).criteria.find((c) => c.id === "protein")!;
    // (25 + 0.25) / 2 = 12.6
    assert.equal(protein.averagePerPortion, 12.6);
  });

  test("Ballaststoffe werden eigenständig bewertet", () => {
    const entries = [entry(0, [], [{ amount: 400, unit: "g", fiber_100: 8 }])];
    const fiber = evaluateWeek(entries).criteria.find((c) => c.id === "fiber")!;
    assert.equal(fiber.count, 1); // 32 g / 4 Portionen = 8 g >= 7 g
  });

  test("Rotes Fleisch bleibt tag-basiert und begrenzt nach oben", () => {
    const few = [0, 1].map((d) => entry(d, ["rind"]));
    assert.equal(evaluateWeek(few).criteria.find((c) => c.id === "redmeat")!.ampel, "gruen");
    const many = [0, 1, 2, 3].map((d) => entry(d, ["schwein"]));
    assert.equal(evaluateWeek(many).criteria.find((c) => c.id === "redmeat")!.ampel, "rot");
  });

  test("Gerichtekategorien wie vegetarisch/Fisch sind kein Kriterium mehr", () => {
    const ids = evaluateWeek([entry(0, [])]).criteria.map((c) => c.id);
    assert.deepEqual(ids, ["protein", "fiber", "iron", "calcium", "redmeat", "fried"]);
  });

  test("Gesamtampel ist das schlechteste Kriterium", () => {
    const entries = [entry(0, [], [proteinPoor])];
    assert.equal(evaluateWeek(entries).overall, "rot");
  });
});
