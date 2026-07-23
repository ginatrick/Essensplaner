import type { OptimizerSettings, VariantId, VariantResult } from "./types.ts";

// docs/08-modul-rewe-vergleich.md Empfehlungslogik, 1:1 übernommen:
// if C.kosten <= A.kosten + TOLERANZ_EUR and C.zeit < A.zeit - 30: empfehle C
// elif A.kosten < C.kosten - SCHWELLE_EUR: empfehle A
// else: empfehle D
export function recommend(variants: VariantResult[], settings: OptimizerSettings): VariantId {
  const a = variants.find((v) => v.id === "A");
  const c = variants.find((v) => v.id === "C");
  if (!a || !c) throw new Error("Varianten A und C müssen vorhanden sein");

  const toleranceCent = Math.round(settings.toleranceEur * 100);
  const thresholdCent = Math.round(settings.thresholdEur * 100);

  if (c.totalCent <= a.totalCent + toleranceCent && c.minutes < a.minutes - 30) {
    return "C";
  }
  if (a.totalCent < c.totalCent - thresholdCent) {
    return "A";
  }
  return "D";
}
