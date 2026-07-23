import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { pickMainIngredient } from "./mainIngredient.ts";

describe("pickMainIngredient", () => {
  test("wählt die mengenmäßig größte Gewichts-/Volumen-Zutat", () => {
    const result = pickMainIngredient([
      { ingredient_id: "salz", amount: 5, unit: "g", is_optional: false },
      { ingredient_id: "haehnchen", amount: 500, unit: "g", is_optional: false },
      { ingredient_id: "oel", amount: 30, unit: "ml", is_optional: false },
    ]);
    assert.equal(result, "haehnchen");
  });

  test("ignoriert optionale Zutaten, wenn nicht-optionale existieren", () => {
    const result = pickMainIngredient([
      { ingredient_id: "deko", amount: 1000, unit: "g", is_optional: true },
      { ingredient_id: "reis", amount: 200, unit: "g", is_optional: false },
    ]);
    assert.equal(result, "reis");
  });

  test("Stückgut nur als Fallback ohne Gewichts-/Volumenangabe", () => {
    const result = pickMainIngredient([
      { ingredient_id: "ei", amount: 3, unit: "stk", is_optional: false },
      { ingredient_id: "zwiebel", amount: 1, unit: "stk", is_optional: false },
    ]);
    assert.equal(result, "ei");
  });

  test("leere Liste -> null", () => {
    assert.equal(pickMainIngredient([]), null);
  });
});
