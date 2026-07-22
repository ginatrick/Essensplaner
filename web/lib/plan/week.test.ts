import { test } from "node:test";
import assert from "node:assert/strict";
import { weekStartIso, addWeeks, dateForDay, dayLabel, formatShortDate, formatWeekRange } from "./week.ts";

test("weekStartIso liefert den Montag der Woche", () => {
  // Donnerstag, 22. Juli 2026 -> Montag 20. Juli 2026
  assert.equal(weekStartIso(new Date("2026-07-23T10:00:00Z")), "2026-07-20");
  // Ein Montag selbst bleibt der Montag
  assert.equal(weekStartIso(new Date("2026-07-20T10:00:00Z")), "2026-07-20");
  // Sonntag gehört noch zur laufenden Woche
  assert.equal(weekStartIso(new Date("2026-07-26T10:00:00Z")), "2026-07-20");
});

test("addWeeks springt vor und zurück", () => {
  assert.equal(addWeeks("2026-07-20", 1), "2026-07-27");
  assert.equal(addWeeks("2026-07-20", -1), "2026-07-13");
});

test("dateForDay und dayLabel: Tag 0 ist Montag, Tag 6 Sonntag", () => {
  assert.equal(dayLabel(0), "Mo");
  assert.equal(dayLabel(6), "So");
  assert.equal(formatShortDate(dateForDay("2026-07-20", 0)), "20. Juli");
  assert.equal(formatShortDate(dateForDay("2026-07-20", 6)), "26. Juli");
});

test("formatWeekRange über Monatsgrenze hinweg", () => {
  assert.equal(formatWeekRange("2026-07-27"), "27. Juli – 2. August 2026");
});
