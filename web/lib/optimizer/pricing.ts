import type { ItemAssignment, PriceOffer, ShoppingNeedItem } from "./types.ts";

// Kosten als Preis-pro-benötigter-Menge (kontinuierlich, price_cent/amount *
// benötigte Menge) — keine Pack-Rundung pro Angebot. Das wäre ein
// Bin-Packing-Problem pro Store, das für einen Kosten-VERGLEICH zwischen
// Varianten nicht nötig ist; die tatsächliche Packungsrundung für die
// Einkaufsliste passiert schon pro Store beim Anzeigen (web/lib/plan/aggregate.ts).
export function cheapestAssignment(
  item: ShoppingNeedItem,
  offers: PriceOffer[],
  storeIds: string[],
): ItemAssignment {
  const storeSet = new Set(storeIds);
  const candidates = offers.filter(
    (o) => storeSet.has(o.store_id) && o.ingredient_id === item.ingredient_id && o.unit === item.unit && o.amount > 0,
  );
  if (candidates.length === 0) {
    return { ingredient_id: item.ingredient_id, store_id: null, price_cent: null };
  }

  let best = candidates[0]!;
  let bestUnitPrice = best.price_cent / best.amount;
  for (const candidate of candidates.slice(1)) {
    const unitPrice = candidate.price_cent / candidate.amount;
    if (unitPrice < bestUnitPrice) {
      best = candidate;
      bestUnitPrice = unitPrice;
    }
  }

  return {
    ingredient_id: item.ingredient_id,
    store_id: best.store_id,
    price_cent: Math.round(bestUnitPrice * item.amount),
  };
}
