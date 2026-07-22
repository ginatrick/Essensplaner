import { test } from "node:test";
import assert from "node:assert/strict";
import { isVegetarian, isFish, isEffortHigh, isRepeatedWithin14Days, weekRuleSummary, type RuleEntry } from "./rules.ts";

function recipe(id: string, tags: string[] | null = [], prep = 0, cook = 0) {
  return { id, tags, prep_min: prep, cook_min: cook };
}
function entry(day: number, r: ReturnType<typeof recipe>, pinned = false): RuleEntry {
  return { day, recipe: r, pinned };
}

test("isVegetarian erkennt Freitext-Tags case-insensitive", () => {
  assert.equal(isVegetarian(recipe("1", ["Vegetarisch"])), true);
  assert.equal(isVegetarian(recipe("1", ["VEGAN"])), true);
  assert.equal(isVegetarian(recipe("1", ["Fleisch"])), false);
  assert.equal(isVegetarian(recipe("1", null)), false);
});

test("isFish erkennt 'fisch' im Tag", () => {
  assert.equal(isFish(recipe("1", ["Fischgericht"])), true);
  assert.equal(isFish(recipe("1", ["Vegetarisch"])), false);
});

test("isEffortHigh: Schwelle prep+cook > 60", () => {
  assert.equal(isEffortHigh(recipe("1", [], 30, 30)), false); // genau 60 -> kein Hinweis
  assert.equal(isEffortHigh(recipe("1", [], 30, 31)), true);
});

test("isRepeatedWithin14Days: gleiches Rezept innerhalb 14 Tage meldet Wiederholung", () => {
  const r = recipe("rezept-a");
  const week = [entry(0, r), entry(5, r)];
  assert.equal(isRepeatedWithin14Days(week[1], week, []), true);
});

test("isRepeatedWithin14Days: pinned wird ausgenommen", () => {
  const r = recipe("rezept-a");
  const week = [entry(0, r, true), entry(5, r)];
  assert.equal(isRepeatedWithin14Days(week[1], week, []), false);
});

test("isRepeatedWithin14Days: berücksichtigt Vorwoche (14 Tage rückwärts)", () => {
  const r = recipe("rezept-a");
  const current = [entry(1, r)]; // Dienstag dieser Woche
  const previous = [entry(6, r)]; // Sonntag letzter Woche, also -1 Tag relativ -> innerhalb 14 Tage
  assert.equal(isRepeatedWithin14Days(current[0], current, previous), true);
});

test("isRepeatedWithin14Days: außerhalb 14 Tage keine Wiederholung", () => {
  const r = recipe("rezept-a");
  const current = [entry(6, r)]; // Sonntag dieser Woche, Tag 6
  const previous = [entry(0, r)]; // Montag letzter Woche -> Offset -7, Differenz = 13 -> noch innerhalb
  assert.equal(isRepeatedWithin14Days(current[0], current, previous), true);
  // Anderes Rezept an einem anderen Tag: keine Wiederholung
  assert.equal(isRepeatedWithin14Days(entry(0, recipe("andere")), current, previous), false);
});

test("weekRuleSummary meldet fehlendes Vegetarisch/Fisch über die ganze Woche", () => {
  const withVeg = [entry(0, recipe("1", ["vegetarisch"])), entry(1, recipe("2", ["fleisch"]))];
  assert.deepEqual(weekRuleSummary(withVeg), { missingVegetarian: false, missingFish: true });

  const none = [entry(0, recipe("1", ["fleisch"]))];
  assert.deepEqual(weekRuleSummary(none), { missingVegetarian: true, missingFish: true });

  const both = [entry(0, recipe("1", ["vegetarisch"])), entry(1, recipe("2", ["fisch"]))];
  assert.deepEqual(weekRuleSummary(both), { missingVegetarian: false, missingFish: false });

  assert.deepEqual(weekRuleSummary([]), { missingVegetarian: false, missingFish: false });
});
