import { bestRoute } from "./route.ts";
import { cheapestAssignment } from "./pricing.ts";
import type {
  ItemAssignment,
  OptimizerSettings,
  PriceOffer,
  ShoppingNeedItem,
  StoreInfo,
  VariantId,
  VariantResult,
} from "./types.ts";

// Zeitaufwand-Aufschläge pro Marktbesuch (docs/08-modul-rewe-vergleich.md,
// Zeile "Zeitaufwand"): A/D "20 min/Markt", B "25 min" (Parken, Suchen,
// Kasse in einem unbekannteren/größeren Markt), C "5 min" (nur Abholung).
const MULTI_STORE_MINUTES_PER_STOP = 20;
const SINGLE_STORE_MINUTES = 25;
const REWE_PICKUP_MINUTES = 5;

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((c) => [first!, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// Ein Markt pro Kette (der nächstgelegene) — niemand fährt zwei ALDI-Filialen
// in derselben Tour ab, siehe docs/06 Marktradius.
function nearestPerChain(stores: StoreInfo[]): StoreInfo[] {
  const byChain = new Map<string, StoreInfo>();
  for (const store of stores) {
    const current = byChain.get(store.chain);
    if (!current || store.distance_km < current.distance_km) {
      byChain.set(store.chain, store);
    }
  }
  return [...byChain.values()];
}

function assignAll(items: ShoppingNeedItem[], offers: PriceOffer[], storeIds: string[]): ItemAssignment[] {
  return items.map((item) => cheapestAssignment(item, offers, storeIds));
}

function sumGoodsCent(assignments: ItemAssignment[]): number {
  return assignments.reduce((sum, a) => sum + (a.price_cent ?? 0), 0);
}

function countMissing(assignments: ItemAssignment[]): number {
  return assignments.filter((a) => a.store_id === null).length;
}

function buildVariant(
  id: VariantId,
  label: string,
  stores: StoreInfo[],
  minutesOverhead: number,
  items: ShoppingNeedItem[],
  offers: PriceOffer[],
  settings: OptimizerSettings,
  serviceFeeCent = 0,
): VariantResult {
  const route = bestRoute(stores);
  const assignments = assignAll(items, offers, stores.map((s) => s.id));
  const goodsCostCent = sumGoodsCent(assignments);
  const travelCostCent = Math.round(route.distanceKm * settings.costPerKm * 100);
  const minutes = Math.round(route.minutes + minutesOverhead);
  const timeCostCent = Math.round((minutes / 60) * settings.costPerHour * 100);
  const totalCent = goodsCostCent + travelCostCent + timeCostCent + serviceFeeCent;

  return {
    id,
    label,
    store_ids: stores.map((s) => s.id),
    goodsCostCent,
    travelCostCent,
    timeCostCent,
    serviceFeeCent,
    totalCent,
    minutes,
    assignments,
    missingCount: countMissing(assignments),
  };
}

function cheapestVariant(candidates: VariantResult[]): VariantResult {
  return candidates.reduce((best, v) => (v.totalCent < best.totalCent ? v : best));
}

// Beste Kombination aus bis zu maxStores Märkten (alle Größen 1..maxStores,
// nicht nur exakt maxStores — mehr Märkte lohnt sich nicht immer).
function bestMultiStoreVariant(
  id: VariantId,
  label: string,
  candidates: StoreInfo[],
  maxStores: number,
  items: ShoppingNeedItem[],
  offers: PriceOffer[],
  settings: OptimizerSettings,
): VariantResult {
  const sizes = Array.from({ length: Math.min(maxStores, candidates.length) }, (_, i) => i + 1);
  const options = sizes.flatMap((size) =>
    combinations(candidates, size).map((combo) =>
      buildVariant(id, label, combo, combo.length * MULTI_STORE_MINUTES_PER_STOP, items, offers, settings),
    ),
  );
  if (options.length === 0) {
    return buildVariant(id, label, [], 0, items, offers, settings);
  }
  const best = cheapestVariant(options);
  return { ...best, label: `${label} (${best.store_ids.length})` };
}

export function computeVariants(
  items: ShoppingNeedItem[],
  offers: PriceOffer[],
  reweOffers: PriceOffer[],
  allStores: StoreInfo[],
  settings: OptimizerSettings,
): VariantResult[] {
  const nonRewe = nearestPerChain(allStores.filter((s) => s.chain !== "REWE"));
  const reweStore = allStores.find((s) => s.chain === "REWE");

  const singleOptions = nonRewe.map((store) =>
    buildVariant("B", `Einzelmarkt: ${store.name}`, [store], SINGLE_STORE_MINUTES, items, offers, settings),
  );
  const variantB =
    singleOptions.length > 0
      ? cheapestVariant(singleOptions)
      : buildVariant("B", "Einzelmarkt", [], 0, items, offers, settings);

  const variantA = bestMultiStoreVariant("A", "Multi-Markt", nonRewe, settings.maxMultiStoreCount, items, offers, settings);
  const variantD = bestMultiStoreVariant(
    "D",
    "Kompromiss",
    nonRewe,
    Math.min(settings.compromiseStoreCount, nonRewe.length),
    items,
    offers,
    settings,
  );

  const variantC = buildVariant(
    "C",
    "REWE Abholservice",
    reweStore ? [reweStore] : [],
    REWE_PICKUP_MINUTES,
    items,
    reweOffers,
    settings,
    settings.reweServiceFeeCent,
  );

  return [variantA, variantB, variantC, variantD];
}
