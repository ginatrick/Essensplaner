import { test } from "node:test";
import assert from "node:assert/strict";
import { entriesForPlan } from "./templates.ts";

test("entriesForPlan kopiert Felder und hängt die Ziel-Plan-ID an", () => {
  const rows = [
    { day: 0, slot: "abend", recipe_id: "r1", servings: 4, pinned: true },
    { day: 2, slot: "mittag", recipe_id: "r2", servings: 2, pinned: false },
  ];
  assert.deepEqual(entriesForPlan("plan-x", rows), [
    { plan_id: "plan-x", day: 0, slot: "abend", recipe_id: "r1", servings: 4, pinned: true },
    { plan_id: "plan-x", day: 2, slot: "mittag", recipe_id: "r2", servings: 2, pinned: false },
  ]);
});

test("entriesForPlan mit leerer Liste liefert leere Liste", () => {
  assert.deepEqual(entriesForPlan("plan-x", []), []);
});
