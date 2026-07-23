import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cheapestAssignment } from "./pricing.ts";
import type { PriceOffer, ShoppingNeedItem } from "./types.ts";

const need: ShoppingNeedItem = { ingredient_id: "milch", amount: 1000, unit: "ml" };

describe("cheapestAssignment", () => {
  test("kein Angebot im Set -> kein Treffer", () => {
    const result = cheapestAssignment(need, [], ["store-a"]);
    assert.deepEqual(result, { ingredient_id: "milch", store_id: null, price_cent: null });
  });

  test("nur ein Kandidat -> dessen Preis für die benötigte Menge", () => {
    const offers: PriceOffer[] = [
      { store_id: "store-a", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 109 },
    ];
    assert.deepEqual(cheapestAssignment(need, offers, ["store-a"]), {
      ingredient_id: "milch", store_id: "store-a", price_cent: 109,
    });
  });

  test("mehrere Kandidaten -> günstigster Preis pro Basiseinheit gewinnt", () => {
    const offers: PriceOffer[] = [
      { store_id: "store-a", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 109 },
      { store_id: "store-b", ingredient_id: "milch", amount: 500, unit: "ml", price_cent: 45 }, // 0.09/ml, günstiger
    ];
    assert.deepEqual(cheapestAssignment(need, offers, ["store-a", "store-b"]), {
      ingredient_id: "milch", store_id: "store-b", price_cent: 90,
    });
  });

  test("Einheiten-Mismatch wird ignoriert", () => {
    const offers: PriceOffer[] = [
      { store_id: "store-a", ingredient_id: "milch", amount: 1, unit: "stk", price_cent: 50 },
    ];
    assert.equal(cheapestAssignment(need, offers, ["store-a"]).store_id, null);
  });

  test("Angebote außerhalb des Store-Sets werden ignoriert", () => {
    const offers: PriceOffer[] = [
      { store_id: "store-x", ingredient_id: "milch", amount: 1000, unit: "ml", price_cent: 50 },
    ];
    assert.equal(cheapestAssignment(need, offers, ["store-a"]).store_id, null);
  });
});
