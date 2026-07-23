export type BaseUnit = "g" | "ml" | "stk";

export type ShoppingNeedItem = {
  ingredient_id: string;
  amount: number;
  unit: BaseUnit;
};

// Ein Preispunkt für eine Zutat an einem Markt — amount/unit sind die Menge,
// auf die sich price_cent bezieht (offers/rewe_prices, siehe docs/03).
export type PriceOffer = {
  store_id: string;
  ingredient_id: string;
  amount: number;
  unit: BaseUnit;
  price_cent: number;
};

export type StoreInfo = {
  id: string;
  chain: string;
  name: string;
  lat: number;
  lng: number;
  distance_km: number;
  drive_min: number;
};

export type OptimizerSettings = {
  costPerKm: number;
  costPerHour: number;
  maxMultiStoreCount: number;
  compromiseStoreCount: number;
  toleranceEur: number;
  thresholdEur: number;
  reweServiceFeeCent: number;
};

export type VariantId = "A" | "B" | "C" | "D";

export type ItemAssignment = {
  ingredient_id: string;
  store_id: string | null;
  price_cent: number | null;
};

export type VariantResult = {
  id: VariantId;
  label: string;
  store_ids: string[];
  goodsCostCent: number;
  travelCostCent: number;
  timeCostCent: number;
  serviceFeeCent: number;
  totalCent: number;
  minutes: number;
  assignments: ItemAssignment[];
  missingCount: number;
};
