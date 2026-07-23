import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { recommend } from "./recommend.ts";
import { DEFAULT_SETTINGS } from "./settings.ts";
import type { VariantResult } from "./types.ts";

function variant(id: VariantResult["id"], totalCent: number, minutes: number): VariantResult {
  return {
    id, label: id, store_ids: [], goodsCostCent: totalCent, travelCostCent: 0, timeCostCent: 0,
    serviceFeeCent: 0, totalCent, minutes, assignments: [], missingCount: 0,
  };
}

describe("recommend", () => {
  test("REWE, wenn günstig genug und deutlich schneller", () => {
    const variants = [
      variant("A", 3000, 90),
      variant("B", 2800, 60),
      variant("C", 3200, 40), // <= 3000 + 500 (Toleranz) und < 90-30=60 Minuten
      variant("D", 2900, 80),
    ];
    assert.equal(recommend(variants, DEFAULT_SETTINGS), "C");
  });

  test("Multi-Markt, wenn deutlich günstiger als REWE", () => {
    const variants = [
      variant("A", 2000, 90),
      variant("B", 2800, 60),
      variant("C", 3200, 85), // Zeitvorteil zu klein für C, Kostenvorteil A groß genug
      variant("D", 2900, 80),
    ];
    assert.equal(recommend(variants, DEFAULT_SETTINGS), "A");
  });

  test("sonst Kompromiss D", () => {
    const variants = [
      variant("A", 2950, 90), // knapp günstiger als C, aber Zeitvorteil fehlt
      variant("B", 2800, 60),
      variant("C", 3000, 85),
      variant("D", 2900, 80),
    ];
    assert.equal(recommend(variants, DEFAULT_SETTINGS), "D");
  });

  test("wirft ohne Variante A oder C", () => {
    assert.throws(() => recommend([variant("B", 100, 10)], DEFAULT_SETTINGS));
  });
});
