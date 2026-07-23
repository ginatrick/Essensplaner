import { describe, expect, test } from "vitest";
import { aggregateIngredients, groupByDepartment } from "./aggregate.ts";

describe("aggregateIngredients", () => {
  test("summiert dieselbe Zutat über mehrere Einträge, skaliert mit Portionen", () => {
    const result = aggregateIngredients([
      { servings: 4, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "tomate", amount: 200, unit: "g" }] },
      { servings: 2, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "tomate", amount: 200, unit: "g" }] },
    ]);
    expect(result).toEqual([{ ingredient_id: "tomate", amount: 300, unit: "g" }]);
  });

  test("hält verschiedene Zutaten getrennt", () => {
    const result = aggregateIngredients([
      { servings: 4, recipe: { servings_base: 4 }, ingredients: [{ ingredient_id: "a", amount: 1, unit: "stk" }, { ingredient_id: "b", amount: 2, unit: "g" }] },
    ]);
    expect(result).toHaveLength(2);
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
    expect(result.map((g) => g.name)).toEqual(["Backwaren", "Obst", "Sonstiges"]);
  });
});
