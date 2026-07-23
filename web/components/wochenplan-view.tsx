"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Plus, Pencil, Trash2, UtensilsCrossed, BookmarkPlus, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { weekStartIso, addWeeks, dateForDay, dayLabel, formatShortDate, formatWeekRange } from "@/lib/plan/week";
import { isEffortHigh, isRepeatedWithin14Days, weekRuleSummary, type RuleEntry } from "@/lib/plan/rules";
import { entriesForPlan } from "@/lib/plan/templates";

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
  return { day: e.day, recipe: e.recipe, pinned: e.pinned };
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
        if (created.error) { if (!cancelled) { setError("Wochenplan konnte nicht angelegt werden."); setLoading(false); } return; }
        plan = created.data;
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
    } else {
      await supabase.from("meal_plan_entries").insert({ plan_id: planId, day, slot: SLOT, recipe_id: recipeId, servings: 4 });
    }
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
