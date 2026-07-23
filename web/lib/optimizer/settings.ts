import type { OptimizerSettings } from "./types.ts";

// docs/08-modul-rewe-vergleich.md: TOLERANZ_EUR/SCHWELLE_EUR sind bewusst
// einstellbar ("Patrick stellt selbst ein, was ihm seine Zeit wert ist") —
// hier nur sinnvolle Startwerte, Persistenz folgt mit der Settings-UI.
export const DEFAULT_SETTINGS: OptimizerSettings = {
  costPerKm: 0.3,
  costPerHour: 0,
  maxMultiStoreCount: 3,
  compromiseStoreCount: 2,
  toleranceEur: 5,
  thresholdEur: 5,
  reweServiceFeeCent: 0,
};
