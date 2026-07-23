import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine } from "./parseLine.ts";

test("Menge + angehängte Einheit ohne Leerzeichen", () => {
  assert.deepEqual(parseIngredientLine("500g Rinderhack"), {
    amount: 500,
    unit: "g",
    name: "Rinderhack",
    note: null,
  });
});

test("Menge + Einheit mit Leerzeichen", () => {
  assert.deepEqual(parseIngredientLine("2 EL Olivenöl"), {
    amount: 2,
    unit: "EL",
    name: "Olivenöl",
    note: null,
  });
});

test("Stückgut-Einheit (Bund) mit mehrwortigem Namen", () => {
  assert.deepEqual(parseIngredientLine("1 Bund glatte Petersilie"), {
    amount: 1,
    unit: "Bund",
    name: "glatte Petersilie",
    note: null,
  });
});

test("Keine erkennbare Einheit → unit=null, ganzer Rest ist Name", () => {
  assert.deepEqual(parseIngredientLine("3 Eier"), {
    amount: 3,
    unit: null,
    name: "Eier",
    note: null,
  });
});

test("Dezimalkomma wird zu Punkt normalisiert", () => {
  assert.deepEqual(parseIngredientLine("1,5 l Milch"), {
    amount: 1.5,
    unit: "l",
    name: "Milch",
    note: null,
  });
});

test("Keine führende Menge → amount=1, unit=null, Text unverändert", () => {
  assert.deepEqual(parseIngredientLine("Salz nach Geschmack"), {
    amount: 1,
    unit: null,
    name: "Salz nach Geschmack",
    note: null,
  });
});

test("Trimmt Whitespace am Rand", () => {
  assert.deepEqual(parseIngredientLine("  2 TL Zucker  "), {
    amount: 2,
    unit: "TL",
    name: "Zucker",
    note: null,
  });
});

test("Klammer-Zusatz (Verpackungs-/Zubereitungshinweis) wird aus dem Namen entfernt und als note aufgehoben", () => {
  assert.deepEqual(parseIngredientLine("1 Dose Mais (à 140 g Abtropfgewicht)"), {
    amount: 1,
    unit: "Dose",
    name: "Mais",
    note: "à 140 g Abtropfgewicht",
  });
});

test("Klammer-Zusatz ohne erkannte Einheit", () => {
  assert.deepEqual(parseIngredientLine("2 Zwiebeln (fein gewürfelt)"), {
    amount: 2,
    unit: null,
    name: "Zwiebeln",
    note: "fein gewürfelt",
  });
});

test("Klammer-Zusatz ohne führende Menge", () => {
  assert.deepEqual(parseIngredientLine("Salz (nach Geschmack)"), {
    amount: 1,
    unit: null,
    name: "Salz",
    note: "nach Geschmack",
  });
});

test("Unicode-Bruch als Menge", () => {
  assert.deepEqual(parseIngredientLine("½ TL Zimt"), {
    amount: 0.5,
    unit: "TL",
    name: "Zimt",
    note: null,
  });
});

test("Unicode-Bruch ohne Einheit", () => {
  assert.deepEqual(parseIngredientLine("½ Zitrone"), {
    amount: 0.5,
    unit: null,
    name: "Zitrone",
    note: null,
  });
});

test("Gemischte Zahl (1 ½) wird summiert, nicht abgeschnitten", () => {
  assert.deepEqual(parseIngredientLine("1 ½ EL Öl"), {
    amount: 1.5,
    unit: "EL",
    name: "Öl",
    note: null,
  });
});

test("Mehrere Klammer-Zusätze werden zusammengeführt", () => {
  assert.deepEqual(parseIngredientLine("1 Dose Mais (à 140 g) (Abtropfgewicht)"), {
    amount: 1,
    unit: "Dose",
    name: "Mais",
    note: "à 140 g; Abtropfgewicht",
  });
});
