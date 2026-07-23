"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Plus, Pencil, Trash2, UtensilsCrossed, BookmarkPlus, LayoutTemplate, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { weekStartIso, addWeeks, dateForDay, dayLabel, formatShortDate, formatWeekRange } from "@/lib/plan/week";
import { isEffortHigh, isRepeatedWithin14Days, weekRuleSummary, type RuleEntry } from "@/lib/plan/rules";
import { entriesForPlan } from "@/lib/plan/templates";
import { evaluateWeek, type NutritionEntry, type WeekAmpel } from "@/lib/plan/nutritionEvaluator";
import { logHabitEvent } from "@/lib/habits/logEvent";
import { generateWeekSuggestion, type SuggestedWeekResult } from "@/app/(app)/plan/actions";

type RecipeSummary = {
  id: string;
  title: string;
  prep_min: number | null;
  cook_min: number | null;
  tags: string[] | null;
  image_path: string | null;
};

type Entry = { id: string; day: number; recipe: RecipeSummary; pinned: boolean };

function toRuleEntry(e: Entry): RuleEntry {
  return { id: e.id, day: e.day, recipe: e.recipe, pinned: e.pinned };
}

type EntryRow = { id: string; day: number; pinned: boolean | null; recipes: RecipeSummary[] | RecipeSummary | null };

function mapEntries(rows: EntryRow[] | null): Entry[] {
  return (rows ?? [])
    .map((row) => {
      const r = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
      return r ? { id: row.id, day: row.day, recipe: r, pinned: row.pinned ?? false } : null;
    })
    .filter((e): e is Entry => e !== null);
}

// Kleine deterministische Farbzuordnung für Tag-Pills, damit derselbe Tag immer
// dieselbe Farbe bekommt, ohne feste Tag-Namen im Code zu verdrahten.
const TAG_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-blue-100 text-blue-800",
  "bg-orange-100 text-orange-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

const SLOT = "abend"; // Nur ein Slot pro Tag vorerst, siehe docs/04.

export function WochenplanView() {
  const supabase = useMemo(() => createClient(), []);
  const [weekStart, setWeekStart] = useState(() => weekStartIso());
  const [planId, setPlanId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [previousWeekEntries, setPreviousWeekEntries] = useState<RuleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [recipeOptions, setRecipeOptions] = useState<{ id: string; title: string }[]>([]);
  const [pickerText, setPickerText] = useState("");
  const [templates, setTemplates] = useState<{ id: string; template_name: string | null }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [nutritionAmpel, setNutritionAmpel] = useState<WeekAmpel | null>(null);
  const [showNutritionDetails, setShowNutritionDetails] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestedWeekResult | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      let { data: plan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start", weekStart)
        .eq("status", "draft")
        .maybeSingle();

      if (!plan) {
        const created = await supabase
          .from("meal_plans")
          .insert({ user_id: userData.user.id, week_start: weekStart, status: "draft", source: "manual" })
          .select("id")
          .single();
        if (created.error) {
          // Zwischen Prüfen und Anlegen kann ein paralleler Aufruf denselben
          // Plan erzeugt haben (React-Doppelrender, zwei Tabs). Seit dem
          // Unique-Index scheitert der zweite Insert — dann den vorhandenen
          // Plan verwenden statt einen weiteren anzulegen. Genau so entstanden
          // die drei Pläne für dieselbe Woche.
          const retry = await supabase
            .from("meal_plans")
            .select("id")
            .eq("week_start", weekStart)
            .eq("status", "draft")
            .maybeSingle();
          if (!retry.data) { if (!cancelled) { setError("Wochenplan konnte nicht angelegt werden."); setLoading(false); } return; }
          plan = retry.data;
        } else {
          plan = created.data;
        }
      }
      if (cancelled) return;
      setPlanId(plan.id);

      const { data: rows, error: entriesError } = await supabase
        .from("meal_plan_entries")
        .select("id, day, pinned, recipes(id, title, prep_min, cook_min, tags, image_path)")
        .eq("plan_id", plan.id);
      if (cancelled) return;
      if (entriesError) { setError("Wochenplan konnte nicht geladen werden."); setLoading(false); return; }

      setEntries(mapEntries(rows));

      // Für den 14-Tage-Regel-Check: Einträge der Vorwoche nur lesend nachladen.
      const { data: prevPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start", addWeeks(weekStart, -1))
        .eq("status", "draft")
        .maybeSingle();
      if (prevPlan) {
        const { data: prevRows } = await supabase
          .from("meal_plan_entries")
          .select("id, day, pinned, recipes(id, title, prep_min, cook_min, tags, image_path)")
          .eq("plan_id", prevPlan.id);
        if (!cancelled) setPreviousWeekEntries(mapEntries(prevRows).map(toRuleEntry));
      } else if (!cancelled) {
        setPreviousWeekEntries([]);
      }

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [weekStart, supabase]);

  // Wochen-Ampel (docs/09-modul-ernaehrung.md) — läuft immer, wenn sich die
  // Einträge der Woche ändern (Laden, Zuweisen, Löschen, Vorlage anwenden),
  // statt an jeder Mutationsstelle einzeln angestoßen zu werden.
  useEffect(() => {
    let cancelled = false;
    async function loadNutrition() {
      if (entries.length === 0) { setNutritionAmpel(null); return; }
      const recipeIds = [...new Set(entries.map((e) => e.recipe.id))];
      const { data: ingredientRows } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredients(iron_mg_100, calcium_mg_100)")
        .in("recipe_id", recipeIds);
      if (cancelled) return;

      const nutrientsByRecipe = new Map<string, { iron_mg_100: number | null; calcium_mg_100: number | null }[]>();
      for (const row of ingredientRows ?? []) {
        const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
        if (!ing) continue;
        if (!nutrientsByRecipe.has(row.recipe_id)) nutrientsByRecipe.set(row.recipe_id, []);
        nutrientsByRecipe.get(row.recipe_id)!.push(ing);
      }
      const nutritionEntries: NutritionEntry[] = entries.map((e) => ({
        day: e.day,
        tags: e.recipe.tags,
        ingredientNutrients: nutrientsByRecipe.get(e.recipe.id) ?? [],
      }));
      setNutritionAmpel(evaluateWeek(nutritionEntries));
    }
    loadNutrition();
    return () => { cancelled = true; };
  }, [entries, supabase]);

  async function loadTemplates() {
    const { data } = await supabase
      .from("meal_plans")
      .select("id, template_name")
      .eq("status", "template")
      .order("week_start", { ascending: false });
    setTemplates(data ?? []);
  }

  async function saveAsTemplate() {
    if (!planId) return;
    const name = window.prompt("Name der Vorlage:");
    if (!name) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: rows } = await supabase
      .from("meal_plan_entries")
      .select("day, slot, recipe_id, servings, pinned")
      .eq("plan_id", planId);

    const created = await supabase
      .from("meal_plans")
      .insert({ user_id: userData.user.id, week_start: weekStartIso(), status: "template", source: "manual", template_name: name })
      .select("id")
      .single();
    if (created.error || !created.data) { setError("Vorlage konnte nicht gespeichert werden."); return; }

    if (rows && rows.length > 0) {
      await supabase.from("meal_plan_entries").insert(entriesForPlan(created.data.id, rows));
    }
    await loadTemplates();
  }

  async function applyTemplate(templateId: string) {
    if (!planId) return;
    const { data: rows } = await supabase
      .from("meal_plan_entries")
      .select("day, slot, recipe_id, servings, pinned")
      .eq("plan_id", templateId);
    if (!rows || rows.length === 0) return;

    const days = rows.map((r) => r.day);
    await supabase.from("meal_plan_entries").delete().eq("plan_id", planId).in("day", days);
    await supabase.from("meal_plan_entries").insert(entriesForPlan(planId, rows));

    const { data: newRows } = await supabase
      .from("meal_plan_entries")
      .select("id, day, pinned, recipes(id, title, prep_min, cook_min, tags, image_path)")
      .eq("plan_id", planId);
    setEntries(mapEntries(newRows));
    setShowTemplates(false);
  }

  async function deleteTemplate(templateId: string) {
    await supabase.from("meal_plans").delete().eq("id", templateId);
    setTemplates((list) => list.filter((t) => t.id !== templateId));
  }

  // Phase 7 (docs/10-modul-lernen.md): Kandidatenpool + Constraint-Solver +
  // Haiku-Begründung serverseitig, Anzeige/Übernehmen/Verwerfen hier.
  async function requestSuggestion() {
    setSuggestionLoading(true);
    setSuggestionError("");
    try {
      const result = await generateWeekSuggestion();
      if ("error" in result) { setSuggestionError(result.error); return; }
      setSuggestion(result);
    } catch {
      // Ohne Fallback bliebe der Button bei einem Fehler (z.B. Haiku-API
      // down) für immer auf "wird erstellt" hängen, ohne Rückmeldung.
      setSuggestionError("Der Vorschlag konnte nicht erstellt werden. Bitte erneut versuchen.");
    } finally {
      setSuggestionLoading(false);
    }
  }

  async function acceptSuggestion() {
    if (!suggestion || !planId) return;
    for (const slot of suggestion.slots) {
      // upsert statt find-dann-insert: `entries` ist der Stand vom letzten
      // Render und damit veraltet, wenn zweimal schnell hintereinander
      // übernommen wird — so entstand jedes Gericht doppelt im Plan.
      // Konfliktziel ist der Unique-Index aus Migration 20260723240000.
      await supabase
        .from("meal_plan_entries")
        .upsert(
          { plan_id: planId, day: slot.day, slot: SLOT, recipe_id: slot.recipeId, servings: 4 },
          { onConflict: "plan_id,day,slot" },
        );
      await logHabitEvent(supabase, { eventType: "suggestion_accepted", recipeId: slot.recipeId });
    }
    setSuggestion(null);
    const { data: rows } = await supabase
      .from("meal_plan_entries")
      .select("id, day, pinned, recipes(id, title, prep_min, cook_min, tags, image_path)")
      .eq("plan_id", planId);
    setEntries(mapEntries(rows));
  }

  async function discardSuggestion() {
    if (suggestion) {
      for (const slot of suggestion.slots) {
        await logHabitEvent(supabase, { eventType: "recipe_rejected", recipeId: slot.recipeId });
      }
    }
    setSuggestion(null);
  }

  async function searchRecipes(text: string) {
    setPickerText(text);
    if (!text.trim()) { setRecipeOptions([]); return; }
    const { data } = await supabase.from("recipes").select("id, title").ilike("title", `%${text.replace(/[%_]/g, "\\$&")}%`).limit(8);
    setRecipeOptions(data ?? []);
  }

  async function assignRecipe(day: number, recipeId: string) {
    if (!planId) return;
    const existing = entries.find((e) => e.day === day);
    if (existing) {
      await supabase.from("meal_plan_entries").update({ recipe_id: recipeId }).eq("id", existing.id);
      // Ersetzt ein bereits geplantes Gericht -> negatives Signal fürs alte
      // Rezept, das neue zählt separat als recipe_manual_add (aktive Wahl).
      void logHabitEvent(supabase, { eventType: "recipe_swapped", recipeId: existing.recipe.id });
    } else {
      await supabase.from("meal_plan_entries").insert({ plan_id: planId, day, slot: SLOT, recipe_id: recipeId, servings: 4 });
    }
    void logHabitEvent(supabase, { eventType: "recipe_manual_add", recipeId });
    setEditingDay(null);
    setPickerText("");
    setRecipeOptions([]);
    // Reload der Woche, um die aufgelöste Rezept-Info sauber zu bekommen statt manuell zu spiegeln.
    setWeekStart((w) => w);
    const { data: rows } = await supabase
      .from("meal_plan_entries")
      .select("id, day, pinned, recipes(id, title, prep_min, cook_min, tags, image_path)")
      .eq("plan_id", planId);
    setEntries(mapEntries(rows));
  }

  async function removeEntry(entryId: string) {
    await supabase.from("meal_plan_entries").delete().eq("id", entryId);
    setEntries((list) => list.filter((e) => e.id !== entryId));
  }

  const filledCount = entries.length;
  const ruleEntries = useMemo(() => entries.map(toRuleEntry), [entries]);
  const { missingVegetarian, missingFish } = weekRuleSummary(ruleEntries);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">MealPlanner</h1>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle>Dein Wochenplan</CardTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{filledCount} von 7 Mahlzeiten</span>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={requestSuggestion} disabled={suggestionLoading}>
              <Sparkles className="mr-1 h-4 w-4" /> {suggestionLoading ? "Vorschlag wird erstellt …" : "Woche vorschlagen"}
            </Button>
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={saveAsTemplate}>
              <BookmarkPlus className="mr-1 h-4 w-4" /> Als Vorlage speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { const next = !showTemplates; setShowTemplates(next); if (next) void loadTemplates(); }}
            >
              <LayoutTemplate className="mr-1 h-4 w-4" /> Vorlagen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {suggestionError && <p className="text-sm text-destructive">{suggestionError}</p>}
          {suggestion && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <p className="text-sm">{suggestion.explanation}</p>
              <ul className="space-y-1 text-sm">
                {suggestion.slots.map((slot) => (
                  <li key={slot.day} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 font-medium">{dayLabel(slot.day)}</span>
                    <span>{slot.title}</span>
                    {slot.isExploration && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-800">Neu</span>}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button type="button" className="h-8 text-xs" onClick={acceptSuggestion}>Übernehmen</Button>
                <Button type="button" variant="outline" className="h-8 text-xs" onClick={discardSuggestion}>Verwerfen</Button>
              </div>
            </div>
          )}
          {showTemplates && (
            <div className="rounded-lg border border-border p-3">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Vorlagen gespeichert.</p>
              ) : (
                <ul className="space-y-1">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{t.template_name ?? "Vorlage ohne Namen"}</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => applyTemplate(t.id)}>
                          Auf diese Woche anwenden
                        </Button>
                        <Button type="button" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {nutritionAmpel && (
            <div className="rounded-lg border border-border p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm"
                onClick={() => setShowNutritionDetails((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      nutritionAmpel.overall === "gruen" ? "bg-emerald-500" : nutritionAmpel.overall === "gelb" ? "bg-amber-500" : "bg-red-500"
                    }`}
                  />
                  <span className="font-medium">
                    Wochen-Ampel:{" "}
                    {nutritionAmpel.overall === "gruen" ? "Grün" : nutritionAmpel.overall === "gelb" ? "Gelb" : "Rot"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{showNutritionDetails ? "Weniger" : "Details"}</span>
              </button>
              {showNutritionDetails && (
                <ul className="mt-3 space-y-2 text-xs">
                  {nutritionAmpel.criteria.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          c.ampel === "gruen" ? "bg-emerald-500" : c.ampel === "gelb" ? "bg-amber-500" : "bg-red-500"
                        }`}
                      />
                      <span>
                        <span className="font-medium">{c.label}</span> ({c.count})
                        {c.suggestion && <span className="block text-muted-foreground">{c.suggestion}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">Planungshilfe, keine medizinische Beratung.</p>
            </div>
          )}
          {(missingVegetarian || missingFish) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {missingVegetarian && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Kein vegetarischer Tag diese Woche</span>
              )}
              {missingFish && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Kein Fischgericht diese Woche</span>
              )}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : (
            Array.from({ length: 7 }, (_, day) => {
              const entry = entries.find((e) => e.day === day);
              const ruleEntry = ruleEntries.find((e) => e.day === day);
              const date = dateForDay(weekStart, day);
              const isEditing = editingDay === day;

              return (
                <div key={day} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-4">
                    <div className="w-14 shrink-0 text-center">
                      <p className="font-semibold">{dayLabel(day)}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDate(date)}</p>
                    </div>

                    {entry ? (
                      <>
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {entry.recipe.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.recipe.image_path} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
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
                              <span className={`rounded-full px-2 py-0.5 ${tagColor(entry.recipe.tags[0])}`}>{entry.recipe.tags[0]}</span>
                            )}
                            {isEffortHigh(entry.recipe) && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Aufwand hoch</span>
                            )}
                            {ruleEntry && isRepeatedWithin14Days(ruleEntry, ruleEntries, previousWeekEntries) && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Schon in den letzten 14 Tagen</span>
                            )}
                          </div>
                        </Link>
                        <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={() => { setEditingDay(day); setPickerText(""); setRecipeOptions([]); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-destructive" onClick={() => removeEntry(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : isEditing ? (
                      <div className="flex-1">
                        <Input
                          autoFocus
                          placeholder="Rezept suchen …"
                          value={pickerText}
                          onChange={(e) => void searchRecipes(e.target.value)}
                          list={`plan-recipes-${day}`}
                        />
                        <datalist id={`plan-recipes-${day}`}>
                          {recipeOptions.map((r) => <option key={r.id} value={r.title} />)}
                        </datalist>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {recipeOptions.map((r) => (
                            <Button key={r.id} type="button" variant="outline" className="h-7 text-xs" onClick={() => assignRecipe(day, r.id)}>
                              {r.title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="flex-1 justify-start text-muted-foreground" onClick={() => { setEditingDay(day); setPickerText(""); setRecipeOptions([]); }}>
                        <Plus className="mr-2 h-4 w-4" /> Gericht hinzufügen
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
