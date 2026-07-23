"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { weekStartIso, addWeeks, formatWeekRange } from "@/lib/plan/week";
import {
  aggregateIngredients,
  groupByDepartment,
  subtractPantry,
  roundToPackages,
  type GroupedDepartment,
  type IngredientMeta,
  type PantryEntry,
  type PackInfo,
  type PlanEntryWithIngredients,
  type ShoppingItem,
} from "@/lib/plan/aggregate";

type IngredientRow = { ingredient_id: string; amount: number; unit: string; ingredients: { name: string; department_id: number | null; pack_size: number | null; pack_unit: string | null } | null };
type EntryRow = { servings: number; recipes: { servings_base: number; id: string } | null };

function formatAmount(amount: number, unit: string): string {
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded} ${unit}`;
}

export function EinkaufslisteView() {
  const supabase = useMemo(() => createClient(), []);
  const [weekStart, setWeekStart] = useState(() => weekStartIso());
  const [groups, setGroups] = useState<GroupedDepartment<ShoppingItem>[]>([]);
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

      if (!plan) { if (!cancelled) { setGroups([]); setLoading(false); } return; }

      const { data: entryRows, error: entriesError } = await supabase
        .from("meal_plan_entries")
        .select("servings, recipe_id, recipes(id, servings_base)")
        .eq("plan_id", plan.id);
      if (entriesError) { if (!cancelled) { setError("Einkaufsliste konnte nicht geladen werden."); setLoading(false); } return; }

      const entries = (entryRows ?? []) as unknown as (EntryRow & { recipe_id: string })[];
      const recipeIds = [...new Set(entries.map((e) => e.recipe_id))];
      if (recipeIds.length === 0) { if (!cancelled) { setGroups([]); setLoading(false); } return; }

      const { data: ingredientRows, error: ingredientsError } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, amount, unit, ingredients(name, department_id, pack_size, pack_unit)")
        .in("recipe_id", recipeIds);
      if (ingredientsError) { if (!cancelled) { setError("Zutaten konnten nicht geladen werden."); setLoading(false); } return; }

      const { data: departmentRows } = await supabase.from("departments").select("id, name, sort_order");
      const { data: pantryRows } = await supabase.from("pantry").select("ingredient_id, amount, unit");
      if (cancelled) return;

      const byRecipe = new Map<string, { ingredient_id: string; amount: number; unit: string }[]>();
      const ingredientMeta = new Map<string, IngredientMeta>();
      const packs = new Map<string, PackInfo>();
      for (const row of (ingredientRows ?? []) as unknown as (IngredientRow & { recipe_id: string })[]) {
        if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
        byRecipe.get(row.recipe_id)!.push({ ingredient_id: row.ingredient_id, amount: row.amount, unit: row.unit });
        if (!ingredientMeta.has(row.ingredient_id)) {
          ingredientMeta.set(row.ingredient_id, {
            id: row.ingredient_id,
            name: row.ingredients?.name ?? row.ingredient_id,
            department_id: row.ingredients?.department_id ?? null,
          });
          if (row.ingredients?.pack_size != null && row.ingredients.pack_unit) {
            packs.set(row.ingredient_id, { pack_size: row.ingredients.pack_size, pack_unit: row.ingredients.pack_unit });
          }
        }
      }

      const planEntries: PlanEntryWithIngredients[] = entries
        .filter((e) => e.recipes)
        .map((e) => ({
          servings: e.servings,
          recipe: { servings_base: e.recipes!.servings_base },
          ingredients: byRecipe.get(e.recipe_id) ?? [],
        }));

      const departments = new Map((departmentRows ?? []).map((d) => [d.id, d]));
      const pantry = new Map<string, PantryEntry>(
        (pantryRows ?? []).map((r) => [r.ingredient_id, { ingredient_id: r.ingredient_id, amount: r.amount, unit: r.unit }])
      );

      const aggregated = aggregateIngredients(planEntries);
      const needed = subtractPantry(aggregated, pantry);
      const withPackages = roundToPackages(needed, packs);
      setGroups(groupByDepartment(withPackages, ingredientMeta, departments));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [weekStart, supabase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Einkaufsliste</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>Zutaten für die Woche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <ShoppingCart className="h-8 w-8" />
              <p className="text-sm">Noch keine Gerichte für diese Woche geplant.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{group.name}</h2>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {group.items.map((item) => (
                    <li key={item.ingredient_id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">
                        {formatAmount(item.buyAmount, item.unit)}
                        {item.packCount != null && ` (${item.packCount}× Packung)`}
                        {item.buyAmount !== item.needed && ` · Bedarf ${formatAmount(item.needed, item.unit)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
