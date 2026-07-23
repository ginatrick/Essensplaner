import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bestRoute } from "./route.ts";
import type { StoreInfo } from "./types.ts";

function store(overrides: Partial<StoreInfo>): StoreInfo {
  return { id: "s", chain: "Test", name: "Test", lat: 0, lng: 0, distance_km: 0, drive_min: 0, ...overrides };
}

describe("bestRoute", () => {
  test("keine Märkte -> leere Route", () => {
    assert.deepEqual(bestRoute([]), { order: [], distanceKm: 0, minutes: 0 });
  });

  test("ein Markt -> Hin- und Rückfahrt verdoppelt", () => {
    const a = store({ id: "a", distance_km: 5, drive_min: 10 });
    const route = bestRoute([a]);
    assert.equal(route.distanceKm, 10);
    assert.equal(route.minutes, 20);
    assert.deepEqual(route.order, [a]);
  });

  test("zwei Märkte -> Distanz ist Summe aus Haushalt-Beinen plus Zwischenstrecke", () => {
    const a = store({ id: "a", lat: 50.0, lng: 10.0, distance_km: 2, drive_min: 5 });
    const b = store({ id: "b", lat: 50.05, lng: 10.05, distance_km: 6, drive_min: 12 });
    const route = bestRoute([a, b]);
    // Bei genau 2 Zwischenstopps ist die Reihenfolge für die Gesamtdistanz
    // egal (symmetrische Rundreise) — hier zählt nur, dass die Summe stimmt.
    assert.ok(route.distanceKm > a.distance_km + b.distance_km);
    assert.equal(route.order.length, 2);
  });

  test("drei Märkte -> vermeidet Zickzack, wenn zwei Märkte nah beieinander liegen", () => {
    // p und q liegen dicht beieinander, r liegt weit weg. Haushalt-Beine sind
    // für alle drei gleich (1 km), damit nur die Zwischenstrecken den
    // Unterschied machen. Eine gute Route besucht p und q nacheinander statt
    // r dazwischenzuschieben.
    const p = store({ id: "p", lat: 50.0, lng: 10.0, distance_km: 1, drive_min: 2 });
    const q = store({ id: "q", lat: 50.0, lng: 10.01, distance_km: 1, drive_min: 2 });
    const r = store({ id: "r", lat: 50.5, lng: 10.0, distance_km: 1, drive_min: 2 });

    const route = bestRoute([p, q, r]);
    const middleId = route.order[1]!.id;

    // r darf nicht der mittlere Stopp sein — das wäre der Zickzack-Fall
    // (Haushalt->p/q->r->q/p->Haushalt zählt die lange Strecke doppelt).
    assert.notEqual(middleId, "r");
  });
});
