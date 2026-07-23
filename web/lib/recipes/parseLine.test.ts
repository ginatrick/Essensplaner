import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine } from "./parseLine.ts";

test("Menge + angehängte Einheit ohne Leerzeichen", () => {
  assert.deepEqual(parseIngredientLine("500g Rinderhack"), {
    amount: 500,
    unit: "g",
    name: "Rinderhack",
  });
});

test("Menge + Einheit mit Leerzeichen", () => {
  assert.deepEqual(parseIngredientLine("2 EL Olivenöl"), {
    amount: 2,
    unit: "EL",
    name: "Olivenöl",
  });
});

test("Stückgut-Einheit (Bund) mit mehrwortigem Namen", () => {
  assert.deepEqual(parseIngredientLine("1 Bund glatte Petersilie"), {
    amount: 1,
    unit: "Bund",
    name: "glatte Petersilie",
  });
});

test("Keine erkennbare Einheit → unit=null, ganzer Rest ist Name", () => {
  assert.deepEqual(parseIngredientLine("3 Eier"), {
    amount: 3,
    unit: null,
    name: "Eier",
  });
});

test("Dezimalkomma wird zu Punkt normalisiert", () => {
  assert.deepEqual(parseIngredientLine("1,5 l Milch"), {
    amount: 1.5,
    unit: "l",
    name: "Milch",
  });
});

test("Keine führende Menge → amount=1, unit=null, Text unverändert", () => {
  assert.deepEqual(parseIngredientLine("Salz nach Geschmack"), {
    amount: 1,
    unit: null,
    name: "Salz nach Geschmack",
  });
});

test("Trimmt Whitespace am Rand", () => {
  assert.deepEqual(parseIngredientLine("  2 TL Zucker  "), {
    amount: 2,
    unit: "TL",
    name: "Zucker",
  });
});

test("Klammer-Zusatz (Verpackungs-/Zubereitungshinweis) wird aus dem Namen entfernt", () => {
  assert.deepEqual(parseIngredientLine("1 Dose Mais (à 140 g Abtropfgewicht)"), {
    amount: 1,
    unit: "Dose",
    name: "Mais",
  });
});

test("Klammer-Zusatz ohne erkannte Einheit", () => {
  assert.deepEqual(parseIngredientLine("2 Zwiebeln (fein gewürfelt)"), {
    amount: 2,
    unit: null,
    name: "Zwiebeln",
  });
});

test("Klammer-Zusatz ohne führende Menge", () => {
  assert.deepEqual(parseIngredientLine("Salz (nach Geschmack)"), {
    amount: 1,
    unit: null,
    name: "Salz",
  });
});
