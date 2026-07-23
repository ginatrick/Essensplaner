import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { aggregateIngredients, groupByDepartment, subtractPantry, roundToPackages } from "./aggregate.ts";

describe("aggregateIngredients", () => {
  test("summiert dieselbe Zutat über mehrere Einträge, skaliert mit Portionen", () => {
    const result = aggregateIngredients([
      { servings: 4, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "tomate", amount: 200, unit: "g" }] },
      { servings: 2, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "tomate", amount: 200, unit: "g" }] },
    ]);
    assert.deepEqual(result, [{ ingredient_id: "tomate", amount: 300, unit: "g" }]);
  });

  test("hält verschiedene Zutaten getrennt", () => {
    const result = aggregateIngredients([
      { servings: 4, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "a", amount: 1, unit: "stk" }, { ingredient_id: "b", amount: 2, unit: "g" }] },
    ]);
    assert.equal(result.length, 2);
  });
});

describe("groupByDepartment", () => {
  test("gruppiert und sortiert nach sort_order, unbekannte Abteilung landet am Ende", () => {
    const ingredients = new Map([
      ["a", { id: "a", name: "Apfel", department_id: 1 }],
      ["b", { id: "b", name: "Brot", department_id: 2 }],
      ["c", { id: "c", name: "Chips", department_id: null }],
    ]);
    const departments = new Map([
      [1, { id: 1, name: "Obst", sort_order: 2 }],
      [2, { id: 2, name: "Backwaren", sort_order: 1 }],
    ]);
    const result = groupByDepartment(
      [
        { ingredient_id: "a", amount: 1, unit: "stk" },
        { ingredient_id: "b", amount: 1, unit: "stk" },
        { ingredient_id: "c", amount: 1, unit: "stk" },
      ],
      ingredients,
      departments
    );
    assert.deepEqual(result.map((g) => g.name), ["Backwaren", "Obst", "Sonstiges"]);
  });
});

describe("subtractPantry", () => {
  test("zieht Vorrat ab und lässt Bedarf 0 aus der Liste fallen", () => {
    const pantry = new Map([["tomate", { ingredient_id: "tomate", amount: 100, unit: "g" }]]);
    const result = subtractPantry(
      [
        { ingredient_id: "tomate", amount: 300, unit: "g" },
        { ingredient_id: "reis", amount: 100, unit: "g" },
      ],
      pantry
    );
    assert.deepEqual(result, [
      { ingredient_id: "tomate", amount: 300, unit: "g", needed: 200 },
      { ingredient_id: "reis", amount: 100, unit: "g", needed: 100 },
    ]);
  });

  test("kompletter Vorrat deckt Bedarf, Position verschwindet", () => {
    const pantry = new Map([["reis", { ingredient_id: "reis", amount: 500, unit: "g" }]]);
    const result = subtractPantry([{ ingredient_id: "reis", amount: 100, unit: "g" }], pantry);
    assert.deepEqual(result, []);
  });

  test("Einheiten-Mismatch ignoriert Vorrat", () => {
    const pantry = new Map([["reis", { ingredient_id: "reis", amount: 5, unit: "stk" }]]);
    const result = subtractPantry([{ ingredient_id: "reis", amount: 100, unit: "g" }], pantry);
    assert.deepEqual(result, [{ ingredient_id: "reis", amount: 100, unit: "g", needed: 100 }]);
  });
});

describe("roundToPackages", () => {
  test("rundet auf ganze Packungen auf", () => {
    const packs = new Map([["hack", { pack_size: 500, pack_unit: "g" }]]);
    const result = roundToPackages([{ ingredient_id: "hack", amount: 350, unit: "g", needed: 350 }], packs);
    assert.deepEqual(result, [{ ingredient_id: "hack", amount: 350, unit: "g", needed: 350, packCount: 1, buyAmount: 500 }]);
  });

  test("ohne bekannte Packungsgröße bleibt der Bedarf unverändert", () => {
    const result = roundToPackages([{ ingredient_id: "reis", amount: 100, unit: "g", needed: 100 }], new Map());
    assert.deepEqual(result, [{ ingredient_id: "reis", amount: 100, unit: "g", needed: 100, packCount: null, buyAmount: 100 }]);
  });
});
