import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { settingsFromRow, settingsToRow } from "./settingsStore.ts";
import type { OptimizerSettings } from "./types.ts";

describe("settingsFromRow / settingsToRow", () => {
  test("Roundtrip: Row -> Settings -> Row bleibt gleich", () => {
    const row = {
      cost_per_km: 0.35, cost_per_hour: 12, max_multi_store_count: 3,
      compromise_store_count: 2, tolerance_eur: 4, threshold_eur: 6, rewe_service_fee_cent: 190,
    };
    assert.deepEqual(settingsToRow(settingsFromRow(row)), row);
  });

  test("settingsFromRow mappt auf camelCase", () => {
    const settings: OptimizerSettings = settingsFromRow({
      cost_per_km: 0.3, cost_per_hour: 0, max_multi_store_count: 3,
      compromise_store_count: 2, tolerance_eur: 5, threshold_eur: 5, rewe_service_fee_cent: 0,
    });
    assert.equal(settings.costPerKm, 0.3);
    assert.equal(settings.maxMultiStoreCount, 3);
  });
});
