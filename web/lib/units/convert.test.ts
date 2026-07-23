import { test } from "node:test";
import assert from "node:assert/strict";
import { toBaseUnit, toIngredientBaseUnit } from "./convert.ts";

test("Gewichtseinheiten linear auf g", () => {
  assert.deepEqual(toBaseUnit({ amount: 500, unit: "g" }), { amount: 500, unit: "g" });
  assert.deepEqual(toBaseUnit({ amount: 500, unit: "gramm" }), { amount: 500, unit: "g" });
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "kg" }), { amount: 2000, unit: "g" });
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "kilogramm" }), { amount: 2000, unit: "g" });
});

test("Volumeneinheiten linear auf ml", () => {
  assert.deepEqual(toBaseUnit({ amount: 250, unit: "ml" }), { amount: 250, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "l" }), { amount: 1000, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "liter" }), { amount: 1000, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 3, unit: "cl" }), { amount: 30, unit: "ml" });
});

test("EL = 15ml, TL = 5ml, Prise = 0.5g", () => {
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "EL" }), { amount: 30, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "Esslöffel" }), { amount: 30, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "TL" }), { amount: 5, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Teelöffel" }), { amount: 5, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Prise" }), { amount: 0.5, unit: "g" });
});

test("Stückgut wird auf unit=stk durchgereicht, amount unverändert", () => {
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Bund" }), { amount: 1, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Bünde" }), { amount: 1, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "Zehe" }), { amount: 2, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 2, unit: "Zehen" }), { amount: 2, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 3, unit: "Stück" }), { amount: 3, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 3, unit: "Stk" }), { amount: 3, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Dose" }), { amount: 1, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Dosen" }), { amount: 1, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Packung" }), { amount: 1, unit: "stk" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "Packungen" }), { amount: 1, unit: "stk" });
});

test("Case-insensitiv und mit Leerraum", () => {
  assert.deepEqual(toBaseUnit({ amount: 1, unit: " el " }), { amount: 15, unit: "ml" });
  assert.deepEqual(toBaseUnit({ amount: 1, unit: "PRISE" }), { amount: 0.5, unit: "g" });
});

test("Unbekannte Einheit wirft Fehler", () => {
  assert.throws(() => toBaseUnit({ amount: 1, unit: "Schuss" }), /Unbekannte Einheit/);
});

test("Angleichung an die Basiseinheit der Zutat: TL Salz (g) statt ml", () => {
  // Ohne Angleichung käme 5 ml heraus, obwohl Salz in g geführt wird — die
  // Einkaufsliste würde ml zu g addieren.
  assert.deepEqual(toIngredientBaseUnit({ amount: 1, unit: "TL" }, { base_unit: "g" }), { amount: 5, unit: "g" });
});

test("Angleichung nutzt density_g_ml, wenn gepflegt", () => {
  assert.deepEqual(toIngredientBaseUnit({ amount: 100, unit: "ml" }, { base_unit: "g", density_g_ml: 0.91 }), { amount: 91, unit: "g" });
  assert.deepEqual(toIngredientBaseUnit({ amount: 91, unit: "g" }, { base_unit: "ml", density_g_ml: 0.91 }), { amount: 100, unit: "ml" });
});

test("Passt die Einheit schon, bleibt alles unverändert", () => {
  assert.deepEqual(toIngredientBaseUnit({ amount: 200, unit: "g" }, { base_unit: "g" }), { amount: 200, unit: "g" });
  assert.deepEqual(toIngredientBaseUnit({ amount: 2, unit: "EL" }, { base_unit: "ml" }), { amount: 30, unit: "ml" });
});

test("stk lässt sich ohne Stückgewicht nicht umrechnen und bleibt stehen", () => {
  assert.deepEqual(toIngredientBaseUnit({ amount: 2, unit: "Stück" }, { base_unit: "g" }), { amount: 2, unit: "stk" });
  assert.deepEqual(toIngredientBaseUnit({ amount: 200, unit: "g" }, { base_unit: "stk" }), { amount: 200, unit: "g" });
});
