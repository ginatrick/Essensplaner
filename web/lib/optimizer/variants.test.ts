import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeVariants } from "./variants.ts";
import { DEFAULT_SETTINGS } from "./settings.ts";
import type { PriceOffer, ShoppingNeedItem, StoreInfo } from "./types.ts";

const items: ShoppingNeedItem[] = [
  { ingredient_id: "milch", amount: 1000, unit: "ml" },
  { ingredient_id: "butter", amount: 500, unit: "g" },
  { ingredient_id: "eier", amount: 1, unit: "stk" },
];

const stores: StoreInfo[] = [
  { id: "aldi-nah", chain: "ALDI", name: "ALDI nah", lat: 50.0, lng: 10.0, distance_km: 2, drive_min: 5 },
  { id: "aldi-fern", chain: "ALDI", name: "ALDI fern", lat: 50.2, lng: 10.2, distance_km: 12, drive_min: 20 },
  { id: "lidl", chain: "Lidl", name: "Lidl", lat: 50.01, lng: 10.01, distance_km: 3, drive_min: 7 },
  { id: "rewe", chain: "REWE", name: "REWE", lat: 50.0, lng: 9.99, distance_km: 1, drive_min: 3 },
];

const offers: PriceOffer[] = [
  { store_id: "aldi-nah", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 89 },
  { store_id: "aldi-nah", ingredient_id: "butter", amount: 500, unit: "g", price_cent: 199 },
  { store_id: "lidl", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 95 },
  { store_id: "lidl", ingredient_id: "eier", amount: 1, unit: "stk", price_cent: 249 },
];

const reweOffers: PriceOffer[] = [
  { store_id: "rewe", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 109 },
  { store_id: "rewe", ingredient_id: "butter", amount: 500, unit: "g", price_cent: 220 },
  { store_id: "rewe", ingredient_id: "eier", amount: 1, unit: "stk", price_cent: 259 },
];

describe("computeVariants", () => {
  test("liefert alle vier Varianten", () => {
    const variants = computeVariants(items, offers, reweOffers, stores, DEFAULT_SETTINGS);
    assert.deepEqual(variants.map((v) => v.id), ["A", "B", "C", "D"]);
  });

  test("nutzt pro Kette nur den nächstgelegenen Markt", () => {
    const variants = computeVariants(items, offers, reweOffers, stores, DEFAULT_SETTINGS);
    for (const variant of variants) {
      assert.ok(!variant.store_ids.includes("aldi-fern"));
    }
  });

  test("Variante C deckt alle Zutaten ab (REWE hat vollständiges Sortiment im Fixture)", () => {
    const [, , variantC] = computeVariants(items, offers, reweOffers, stores, DEFAULT_SETTINGS);
    assert.deepEqual(variantC!.store_ids, ["rewe"]);
    assert.equal(variantC!.missingCount, 0);
  });

  test("Variante D ist auf compromiseStoreCount Märkte begrenzt", () => {
    const [, , , variantD] = computeVariants(items, offers, reweOffers, stores, DEFAULT_SETTINGS);
    assert.ok(variantD!.store_ids.length <= DEFAULT_SETTINGS.compromiseStoreCount);
  });

  test("Mehr Märkte im Set können die Abdeckung nur verbessern, nie verschlechtern", () => {
    const [variantA, variantB] = computeVariants(items, offers, reweOffers, stores, DEFAULT_SETTINGS);
    assert.ok(variantA!.missingCount <= variantB!.missingCount);
  });

  test("ohne Angebote überhaupt bleibt jede Variante mit missingCount = Anzahl Zutaten nutzbar (kein Crash)", () => {
    const variants = computeVariants(items, [], [], stores, DEFAULT_SETTINGS);
    for (const variant of variants) {
      assert.equal(variant.missingCount, items.length);
      assert.equal(variant.goodsCostCent, 0);
    }
  });
});
