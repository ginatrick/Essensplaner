import Link from "next/link";
import { Clock, ShoppingCart, Package, TrendingDown, UtensilsCrossed, Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { weekStartIso, formatWeekRange, dayLabel, dateForDay } from "@/lib/plan/week";
import { evaluateWeek, type NutritionEntry } from "@/lib/plan/nutritionEvaluator";
import {
  aggregateIngredients,
  groupByDepartment,
  subtractPantry,
  roundToPackages,
  type DepartmentMeta,
  type IngredientMeta,
  type PackInfo,
  type PantryEntry,
} from "@/lib/plan/aggregate";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

type RecipeJoin = {
  id: string;
  title: string;
  prep_min: number | null;
  cook_min: number | null;
  tags: string[] | null;
  image_path: string | null;
  servings_base: number;
};

type IngredientJoin = {
  name: string | null;
  department_id: number | null;
  pack_size: number | null;
  pack_unit: string | null;
  protein_100: number | null;
  fiber_100: number | null;
  iron_mg_100: number | null;
  calcium_mg_100: number | null;
  piece_weight_g: number | null;
  density_g_ml: number | null;
};

type RecipeIngredientRow = {
  recipe_id: string;
  ingredient_id: string;
  amount: number;
  unit: string;
  ingredients: IngredientJoin[] | IngredientJoin | null;
};

function one<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Ampel-Farbe als Balkenfüllung. Die Wochen-Ampel liefert grün/gelb/rot je
// Kriterium (docs/09), hier nur die Übersetzung nach Tailwind.
const BAR_COLOR = { gruen: "bg-emerald-500", gelb: "bg-amber-500", rot: "bg-red-500" } as const;

export default async function UebersichtPage() {
  const supabase = await createClient();
  const weekStart = weekStartIso();

  // Bewusst .in() statt .maybeSingle(): Migration 20260723240000 stellt einen
  // Plan je Woche sicher, aber vor dem Rollout können mehrere existieren —
  // maybeSingle würde dann werfen und die Seite bliebe leer. So ist das
  // Ergebnis danach identisch und vorher wenigstens brauchbar.
  const { data: plans } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("week_start", weekStart)
    .eq("status", "draft");
  const planIds = (plans ?? []).map((p) => p.id);

  const { data: entryRows } = planIds.length
    ? await supabase
        .from("meal_plan_entries")
        .select("id, day, servings, recipes(id, title, prep_min, cook_min, tags, image_path, servings_base)")
        .in("plan_id", planIds)
    : { data: [] };

  const seenDays = new Set<number>();
  const entries = (entryRows ?? [])
    .map((row) => ({ id: row.id, day: row.day, servings: row.servings, recipe: one(row.recipes as RecipeJoin[] | RecipeJoin | null) }))
    .filter((e): e is typeof e & { recipe: RecipeJoin } => e.recipe !== null)
    .sort((a, b) => a.day - b.day)
    // Ein Gericht je Tag anzeigen. Doppelte Einträge sind Altlast aus der Zeit
    // ohne Unique-Index und verschwinden mit der Migration.
    .filter((e) => (seenDays.has(e.day) ? false : (seenDays.add(e.day), true)));

  const recipeIds = [...new Set(entries.map((e) => e.recipe.id))];

  // Zutaten der Woche einmal laden — dieselben Zeilen tragen sowohl den
  // Nährstoff-Check als auch die konsolidierte Einkaufsliste.
  const { data: ingredientRows } = recipeIds.length
    ? await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, amount, unit, ingredients(name, department_id, pack_size, pack_unit, protein_100, fiber_100, iron_mg_100, calcium_mg_100, piece_weight_g, density_g_ml)")
        .in("recipe_id", recipeIds)
    : { data: [] };

  const [{ data: pantryRows }, { data: departmentRows }, { data: suggestionRecipes }, { count: draftCount }] = await Promise.all([
    supabase.from("pantry").select("ingredient_id, amount, unit"),
    supabase.from("departments").select("id, name, sort_order").order("sort_order"),
    supabase.from("recipes").select("id, title, prep_min, cook_min, tags, image_path").not("image_path", "is", null).order("title").limit(6),
    supabase.from("recipe_ingredient_drafts").select("id", { count: "exact", head: true }),
  ]);

  const rowsByRecipe = new Map<string, RecipeIngredientRow[]>();
  for (const row of (ingredientRows ?? []) as RecipeIngredientRow[]) {
    if (!rowsByRecipe.has(row.recipe_id)) rowsByRecipe.set(row.recipe_id, []);
    rowsByRecipe.get(row.recipe_id)!.push(row);
  }

  // --- Nährstoff-Check ---------------------------------------------------
  const nutritionEntries: NutritionEntry[] = entries.map((e) => ({
    day: e.day,
    tags: e.recipe.tags,
    servings: e.recipe.servings_base,
    ingredients: (rowsByRecipe.get(e.recipe.id) ?? []).map((row) => ({
      amount: row.amount,
      unit: row.unit,
      ...(one(row.ingredients) ?? {}),
    })),
  }));
  const ampel = evaluateWeek(nutritionEntries);

  // --- Konsolidierte Einkaufsliste ---------------------------------------
  const aggregated = aggregateIngredients(
    entries.map((e) => ({
      servings: e.servings,
      recipe: { servings_base: e.recipe.servings_base },
      ingredients: (rowsByRecipe.get(e.recipe.id) ?? []).map((r) => ({ ingredient_id: r.ingredient_id, amount: r.amount, unit: r.unit })),
    })),
  );

  const ingredientMeta = new Map<string, IngredientMeta>();
  const packs = new Map<string, PackInfo>();
  for (const row of (ingredientRows ?? []) as RecipeIngredientRow[]) {
    const ing = one(row.ingredients);
    if (!ing) continue;
    ingredientMeta.set(row.ingredient_id, {
      id: row.ingredient_id,
      name: ing.name ?? "",
      department_id: ing.department_id,
    });
    if (typeof ing.pack_size === "number" && typeof ing.pack_unit === "string") {
      packs.set(row.ingredient_id, { pack_size: ing.pack_size, pack_unit: ing.pack_unit });
    }
  }

  const pantry = new Map<string, PantryEntry>((pantryRows ?? []).map((p) => [p.ingredient_id, p]));
  const departments = new Map<number, DepartmentMeta>((departmentRows ?? []).map((d) => [d.id, d]));
  const shoppingGroups = groupByDepartment(
    roundToPackages(subtractPantry(aggregated, pantry), packs),
    ingredientMeta,
    departments,
  );
  const shoppingCount = shoppingGroups.reduce((sum, g) => sum + g.items.length, 0);

  const warmMeals = entries.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Übersicht</h1>
          <p className="text-sm text-muted-foreground">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium" href="/plan">
            <Plus className="h-4 w-4" /> Gericht hinzufügen
          </Link>
          <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" href="/preisvergleich">
            <Sparkles className="h-4 w-4" /> Plan optimieren
          </Link>
        </div>
      </div>

      {!!draftCount && (
        <Link
          href="/rezepte/unaufgeloest"
          className="block rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="font-medium">{draftCount} nicht zugeordnete Zutaten.</span>{" "}
          Erst wenn alle Zutaten erkannt sind, stimmen Einkaufsliste und Preisvergleich. → jetzt zuordnen
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Wochenplan */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Dein Wochenplan</CardTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {warmMeals} warme Mahlzeit{warmMeals === 1 ? "" : "en"}
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map((day) => {
              const entry = entries.find((e) => e.day === day);
              const date = dateForDay(weekStart, day);
              return (
                <div key={day} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-sm font-medium">{dayLabel(day)}</p>
                    <p className="text-xs text-muted-foreground">{date.getUTCDate()}.</p>
                  </div>
                  {entry ? (
                    <>
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {entry.recipe.image_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.recipe.image_path} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <Link href={`/rezepte/${entry.recipe.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium hover:underline">{entry.recipe.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {(entry.recipe.prep_min ?? 0) + (entry.recipe.cook_min ?? 0)} Min.
                          </span>
                          {entry.recipe.tags?.[0] && (
                            <span className="rounded-full bg-muted px-2 py-0.5">{entry.recipe.tags[0]}</span>
                          )}
                        </div>
                      </Link>
                    </>
                  ) : (
                    <Link href="/plan" className="flex-1 text-sm text-muted-foreground hover:underline">
                      Noch nichts geplant
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Einkaufsliste konsolidiert */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Einkaufsliste
              </CardTitle>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{shoppingCount} Artikel</span>
            </CardHeader>
            <CardContent>
              {shoppingGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nichts zu kaufen — plane zuerst Gerichte ein.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {shoppingGroups.map((g) => (
                    <li key={g.name} className="flex items-center justify-between">
                      <span>{g.name}</span>
                      <span className="text-muted-foreground">{g.items.length}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/einkaufslisten" className="mt-3 inline-block text-sm text-primary hover:underline">
                Vollständige Liste öffnen →
              </Link>
            </CardContent>
          </Card>

          {/* Vorräte */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Bereits zu Hause
              </CardTitle>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{pantryRows?.length ?? 0} Artikel</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {pantryRows?.length
                  ? "Diese Vorräte werden vom Bedarf abgezogen."
                  : "Noch keine Vorräte erfasst — dann wird alles neu eingekauft."}
              </p>
              <Link href="/vorraete" className="mt-3 inline-block text-sm text-primary hover:underline">
                Vorräte pflegen →
              </Link>
            </CardContent>
          </Card>

          {/* Nährstoff-Check */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Nährstoff-Check</CardTitle>
              <span className="text-xs text-muted-foreground">Woche</span>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Plane Gerichte ein, dann wird bewertet.</p>
              ) : (
                <ul className="space-y-2">
                  {ampel.criteria.map((c) => {
                    // Anteil der Tage, die das Kriterium erfüllen — bei "max"-
                    // Regeln (rotes Fleisch) wäre ein voller Balken schlecht,
                    // deshalb dort kein Balken, nur die Zahl.
                    const share = entries.length > 0 ? Math.min(100, Math.round((c.count / entries.length) * 100)) : 0;
                    const isNutrient = c.averagePerPortion !== undefined;
                    return (
                      <li key={c.id} className="space-y-1">
                        <div className="flex items-baseline justify-between text-sm">
                          <span>{c.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {isNutrient ? `Ø ${c.averagePerPortion} ${c.unit ?? ""}` : `${c.count}×`}
                          </span>
                        </div>
                        {isNutrient && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${BAR_COLOR[c.ampel]}`} style={{ width: `${share}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link href="/plan" className="mt-3 inline-block text-sm text-primary hover:underline">
                Details im Wochenplan →
              </Link>
            </CardContent>
          </Card>

          {/* Preisvergleich */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4" /> Preisvergleich
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vergleicht Angebote der Märkte im Umkreis mit dem REWE Abholservice — inklusive Fahrtkosten und Zeitaufwand.
              </p>
              <Link href="/preisvergleich" className="mt-3 inline-block text-sm text-primary hover:underline">
                Varianten berechnen →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rezepte & Vorschläge */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Rezepte &amp; Vorschläge für dich</CardTitle>
          <Link href="/rezepte" className="text-sm text-primary hover:underline">
            Alle Rezepte →
          </Link>
        </CardHeader>
        <CardContent>
          {!suggestionRecipes?.length ? (
            <p className="text-sm text-muted-foreground">Noch keine Rezepte mit Bild vorhanden.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {suggestionRecipes.map((r) => (
                <Link key={r.id} href={`/rezepte/${r.id}`} className="group overflow-hidden rounded-lg border">
                  <div className="h-28 w-full overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image_path!} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium group-hover:underline">{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {(r.prep_min ?? 0) + (r.cook_min ?? 0)} Min.
                      </span>
                      {r.tags?.[0] && <span className="rounded-full bg-muted px-2 py-0.5">{r.tags[0]}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
