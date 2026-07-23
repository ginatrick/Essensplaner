"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingCart, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { weekStartIso, addWeeks, formatWeekRange } from "@/lib/plan/week";
import { saveShoppingListCache, loadShoppingListCache } from "@/lib/plan/offlineCache";
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
  const [planId, setPlanId] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupedDepartment<ShoppingItem>[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [unresolvedRecipes, setUnresolvedRecipes] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setOffline(false);

      try {
        await loadFromNetwork();
      } catch {
        if (cancelled) return;
        const cached = loadShoppingListCache(weekStart);
        if (cached) {
          setPlanId(cached.planId);
          setGroups(cached.groups);
          setChecked(new Set(cached.checked));
          setOffline(true);
        } else {
          setError("Keine Verbindung und kein Offline-Stand für diese Woche vorhanden.");
        }
      }
      if (!cancelled) setLoading(false);
    }

    async function loadFromNetwork() {
      const { data: plan, error: planError } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start", weekStart)
        .eq("status", "draft")
        .maybeSingle();
      if (planError) throw planError;

      if (!plan) { if (!cancelled) { setPlanId(null); setGroups([]); } return; }
      setPlanId(plan.id);

      const { data: entryRows, error: entriesError } = await supabase
        .from("meal_plan_entries")
        .select("servings, recipe_id, recipes(id, servings_base)")
        .eq("plan_id", plan.id);
      if (entriesError) throw entriesError;

      const entries = (entryRows ?? []) as unknown as (EntryRow & { recipe_id: string })[];
      const recipeIds = [...new Set(entries.map((e) => e.recipe_id))];
      if (recipeIds.length === 0) { if (!cancelled) setGroups([]); return; }

      const { data: ingredientRows, error: ingredientsError } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, amount, unit, ingredients(name, department_id, pack_size, pack_unit)")
        .in("recipe_id", recipeIds);
      if (ingredientsError) throw ingredientsError;

      const { data: departmentRows } = await supabase.from("departments").select("id, name, sort_order");
      const { data: pantryRows } = await supabase.from("pantry").select("ingredient_id, amount, unit");
      const { data: checkedRows } = await supabase.from("shopping_checked").select("ingredient_id").eq("plan_id", plan.id);
      // Nicht zugeordnete Zutaten (siehe rezept-form.tsx) fehlen stillschweigend
      // in der Liste, weil sie nicht in recipe_ingredients stehen — Warnung statt
      // stiller Lücke, "Ziel: keine Zutaten ohne entsprechendes Produkt".
      const { data: draftRows } = await supabase
        .from("recipe_ingredient_drafts")
        .select("recipe_id, recipes(title)")
        .in("recipe_id", recipeIds);
      if (cancelled) return;
      setChecked(new Set((checkedRows ?? []).map((r) => r.ingredient_id)));
      const unresolvedMap = new Map<string, string>();
      for (const row of draftRows ?? []) {
        const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
        unresolvedMap.set(row.recipe_id, recipe?.title ?? "Unbekanntes Rezept");
      }
      setUnresolvedRecipes([...unresolvedMap].map(([id, title]) => ({ id, title })));

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
      const grouped = groupByDepartment(withPackages, ingredientMeta, departments);
      if (cancelled) return;
      setGroups(grouped);
      saveShoppingListCache(weekStart, {
        planId: plan.id,
        groups: grouped,
        checked: (checkedRows ?? []).map((r) => r.ingredient_id),
      });
    }
    load();
    return () => { cancelled = true; };
  }, [weekStart, supabase]);

  // Optimistisch: UI reagiert sofort, damit Abhaken auch offline nutzbar ist.
  // ponytail: kein Retry/Sync-Queue — bei fehlgeschlagenem Schreiben (z. B. offline)
  // bleibt der Haken lokal gesetzt, bis die nächste Synchronisierung greift.
  function toggleChecked(ingredientId: string) {
    if (!planId) return;
    const isChecked = checked.has(ingredientId);
    const next = new Set(checked);
    if (isChecked) next.delete(ingredientId); else next.add(ingredientId);
    setChecked(next);
    saveShoppingListCache(weekStart, { planId, groups, checked: [...next] });
    if (isChecked) {
      void supabase.from("shopping_checked").delete().eq("plan_id", planId).eq("ingredient_id", ingredientId);
    } else {
      void supabase.from("shopping_checked").upsert({ plan_id: planId, ingredient_id: ingredientId, checked: true });
    }
  }

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const checkedItems = groups.reduce((sum, g) => sum + g.items.filter((i) => checked.has(i.ingredient_id)).length, 0);

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

      {offline && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
          Offline — zeigt den letzten gespeicherten Stand. Änderungen werden lokal gemerkt und synchronisieren, sobald wieder Verbindung besteht.
        </p>
      )}
      {unresolvedRecipes.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Nicht zugeordnete Zutaten fehlen in dieser Liste — betroffen:{" "}
            {unresolvedRecipes.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ", "}
                <Link className="underline" href={`/rezepte/${r.id}/bearbeiten`}>{r.title}</Link>
              </span>
            ))}
          </span>
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Zutaten für die Woche</CardTitle>
            {totalItems > 0 && <span className="text-xs text-muted-foreground">{checkedItems} von {totalItems}</span>}
          </div>
          {totalItems > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(checkedItems / totalItems) * 100}%` }} />
            </div>
          )}
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
                  {group.items.map((item) => {
                    const isChecked = checked.has(item.ingredient_id);
                    return (
                      <li key={item.ingredient_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChecked(item.ingredient_id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className={`flex-1 ${isChecked ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
                        <span className="text-muted-foreground">
                          {formatAmount(item.buyAmount, item.unit)}
                          {item.packCount != null && ` (${item.packCount}× Packung)`}
                          {item.buyAmount !== item.needed && ` · Bedarf ${formatAmount(item.needed, item.unit)}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
