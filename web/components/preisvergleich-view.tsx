"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { weekStartIso, addWeeks, formatWeekRange } from "@/lib/plan/week";
import { aggregateIngredients, subtractPantry, type PantryEntry } from "@/lib/plan/aggregate";
import { loadSettings } from "@/lib/optimizer/settingsStore";
import { computeVariants } from "@/lib/optimizer/variants";
import { recommend } from "@/lib/optimizer/recommend";
import type { ItemAssignment, PriceOffer, ShoppingNeedItem, StoreInfo, VariantId, VariantResult } from "@/lib/optimizer/types";

type EntryRow = { servings: number; recipe_id: string; recipes: { id: string; servings_base: number } | null };

const VARIANT_LABELS: Record<VariantId, string> = {
  A: "Multi-Markt",
  B: "Bester Einzelmarkt",
  C: "REWE Abholservice",
  D: "Kompromiss",
};

function formatEur(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",") + " €";
}

export function PreisvergleichView() {
  const supabase = useMemo(() => createClient(), []);
  const [weekStart, setWeekStart] = useState(() => weekStartIso());
  const [variants, setVariants] = useState<VariantResult[] | null>(null);
  const [recommended, setRecommended] = useState<VariantId | null>(null);
  const [ingredientNames, setIngredientNames] = useState<Map<string, string>>(new Map());
  const [storeNames, setStoreNames] = useState<Map<string, string>>(new Map());
  const [reweByIngredient, setReweByIngredient] = useState<Map<string, number>>(new Map());
  const [matchRate, setMatchRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");

      const { data: plan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start", weekStart)
        .eq("status", "draft")
        .maybeSingle();
      if (!plan) { if (!cancelled) { setVariants([]); setLoading(false); } return; }

      const { data: entryRows } = await supabase
        .from("meal_plan_entries")
        .select("servings, recipe_id, recipes(id, servings_base)")
        .eq("plan_id", plan.id);
      const entries = (entryRows ?? []) as unknown as EntryRow[];
      const recipeIds = [...new Set(entries.map((e) => e.recipe_id))];
      if (recipeIds.length === 0) { if (!cancelled) { setVariants([]); setLoading(false); } return; }

      const { data: ingredientRows } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, amount, unit")
        .in("recipe_id", recipeIds);
      const byRecipe = new Map<string, { ingredient_id: string; amount: number; unit: string }[]>();
      for (const row of ingredientRows ?? []) {
        if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
        byRecipe.get(row.recipe_id)!.push(row);
      }
      const planEntries = entries
        .filter((e) => e.recipes)
        .map((e) => ({
          servings: e.servings,
          recipe: { servings_base: e.recipes!.servings_base },
          ingredients: byRecipe.get(e.recipe_id) ?? [],
        }));

      const { data: pantryRows } = await supabase.from("pantry").select("ingredient_id, amount, unit");
      const pantry = new Map<string, PantryEntry>(
        (pantryRows ?? []).map((r) => [r.ingredient_id, { ingredient_id: r.ingredient_id, amount: r.amount, unit: r.unit }])
      );
      const aggregated = aggregateIngredients(planEntries);
      const needed = subtractPantry(aggregated, pantry);
      const items: ShoppingNeedItem[] = needed.map((n) => ({ ingredient_id: n.ingredient_id, amount: n.needed, unit: n.unit as ShoppingNeedItem["unit"] }));
      if (items.length === 0) { if (!cancelled) { setVariants([]); setLoading(false); } return; }

      const [{ data: names }, { data: storeRows }, { data: offerRows }, settings] = await Promise.all([
        supabase.from("ingredients").select("id, name").in("id", items.map((i) => i.ingredient_id)),
        supabase.from("stores").select("id, chain, name, lat, lng, distance_km, drive_min, rewe_market_id"),
        supabase
          .from("offers")
          .select("store_id, ingredient_id, amount, unit, price_cent")
          .in("ingredient_id", items.map((i) => i.ingredient_id))
          .gte("confidence", 0.7)
          .not("amount", "is", null),
        loadSettings(supabase),
      ]);
      if (cancelled) return;

      const nameMap = new Map((names ?? []).map((n) => [n.id, n.name]));
      const stores = (storeRows ?? []) as (StoreInfo & { rewe_market_id: string | null })[];
      const storeMap = new Map(stores.map((s) => [s.id, s.name]));
      const offers = (offerRows ?? []) as PriceOffer[];

      const reweStore = stores.filter((s) => s.chain === "REWE").sort((a, b) => a.distance_km - b.distance_km)[0];
      const reweOffers: PriceOffer[] = [];
      const reweMap = new Map<string, number>();
      if (reweStore?.rewe_market_id) {
        const { data: fn } = await supabase.functions.invoke("price-compare", {
          body: { ingredient_ids: items.map((i) => i.ingredient_id), market_id: reweStore.rewe_market_id },
        });
        const prices = (fn?.prices ?? []) as { ingredient_id: string; hit: boolean; amount?: number; unit?: string; price_cent?: number }[];
        for (const p of prices) {
          if (p.hit && p.amount && p.unit && p.price_cent != null) {
            reweOffers.push({ store_id: reweStore.id, ingredient_id: p.ingredient_id, amount: p.amount, unit: p.unit as ShoppingNeedItem["unit"], price_cent: p.price_cent });
            reweMap.set(p.ingredient_id, Math.round((p.price_cent / p.amount) * (items.find((i) => i.ingredient_id === p.ingredient_id)?.amount ?? p.amount)));
          }
        }
      }

      const computed = computeVariants(items, offers, reweOffers, stores, settings);
      if (cancelled) return;

      setIngredientNames(nameMap);
      setStoreNames(storeMap);
      setReweByIngredient(reweMap);
      setMatchRate(items.length > 0 ? reweOffers.length / items.length : null);
      setVariants(computed);
      setRecommended(recommend(computed, settings));
      setLoading(false);
    }
    load().catch(() => { if (!cancelled) { setError("Preisvergleich konnte nicht berechnet werden."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [weekStart, supabase]);

  const cheapestTotal = variants && variants.length > 0 ? Math.min(...variants.map((v) => v.totalCent)) : 0;
  const recommendedVariant = variants?.find((v) => v.id === recommended) ?? null;

  function reasonFor(assignment: ItemAssignment): string {
    const name = ingredientNames.get(assignment.ingredient_id) ?? assignment.ingredient_id;
    if (assignment.store_id === null || assignment.price_cent === null) {
      return `${name}: kein Angebot gefunden`;
    }
    const storeName = storeNames.get(assignment.store_id) ?? "?";
    const reweRef = reweByIngredient.get(assignment.ingredient_id);
    if (reweRef != null && reweRef !== assignment.price_cent) {
      return `${name}: bei ${storeName} ${formatEur(assignment.price_cent)} statt ${formatEur(reweRef)} REWE`;
    }
    return `${name}: bei ${storeName} ${formatEur(assignment.price_cent)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Preisvergleich</h1>
        <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5">
          <Button type="button" variant="ghost" className="h-7 w-7 p-0" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{formatWeekRange(weekStart)}</span>
          <Button type="button" variant="ghost" className="h-7 w-7 p-0" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Berechnet …</p>
      ) : !variants || variants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <TrendingDown className="h-8 w-8" />
          <p className="text-sm">Noch keine Gerichte für diese Woche geplant.</p>
        </div>
      ) : (
        <>
          {matchRate != null && matchRate < 0.9 && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Nur {Math.round(matchRate * 100)}% der Zutaten haben einen REWE-Treffer — Vergleich unvollständig.
            </p>
          )}

          {recommendedVariant && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-lg font-semibold">
                  Empfehlung: {VARIANT_LABELS[recommendedVariant.id]}
                  {recommendedVariant.missingCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({recommendedVariant.missingCount} Position(en) ohne Treffer)
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Varianten im Vergleich</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Variante</th>
                    <th className="py-2 pr-3">Waren</th>
                    <th className="py-2 pr-3">Fahrt</th>
                    <th className="py-2 pr-3">Zeit</th>
                    <th className="py-2 pr-3">Gesamt</th>
                    <th className="py-2 pr-3">Δ zur billigsten</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className={`border-b border-border last:border-0 ${v.id === recommended ? "bg-muted/50" : ""}`}>
                      <td className="py-2 pr-3 font-medium">
                        {VARIANT_LABELS[v.id]}
                        {v.id === recommended && <span className="ml-1 text-xs text-primary">★</span>}
                      </td>
                      <td className="py-2 pr-3">{formatEur(v.goodsCostCent)}</td>
                      <td className="py-2 pr-3">{formatEur(v.travelCostCent)}</td>
                      <td className="py-2 pr-3">{v.minutes} min</td>
                      <td className="py-2 pr-3 font-medium">{formatEur(v.totalCent)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {v.totalCent === cheapestTotal ? "—" : `+${formatEur(v.totalCent - cheapestTotal)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {recommendedVariant && (
            <Card>
              <CardHeader><CardTitle>Begründung — {VARIANT_LABELS[recommendedVariant.id]}</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {[...recommendedVariant.assignments]
                    .sort((a, b) => {
                      const savingA = (reweByIngredient.get(a.ingredient_id) ?? 0) - (a.price_cent ?? 0);
                      const savingB = (reweByIngredient.get(b.ingredient_id) ?? 0) - (b.price_cent ?? 0);
                      return savingB - savingA;
                    })
                    .map((assignment) => (
                      <li key={assignment.ingredient_id} className="px-3 py-2 text-sm">
                        {reasonFor(assignment)}
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
