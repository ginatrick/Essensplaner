"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type RecipeStat = { recipe_id: string; times_planned: number; times_swapped_out: number; last_planned: string | null; recipes: { title: string } | { title: string }[] | null };
type TasteRow = { ingredient_id: string; score: number; n_seen: number; ingredients: { name: string } | { name: string }[] | null };

function firstTitle(rel: RecipeStat["recipes"]): string {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return r?.title ?? "?";
}
function firstName(rel: TasteRow["ingredients"]): string {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return r?.name ?? "?";
}

export function AuswertungenView() {
  const supabase = useMemo(() => createClient(), []);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [recipeStats, setRecipeStats] = useState<RecipeStat[]>([]);
  const [tasteRows, setTasteRows] = useState<TasteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: acceptedCount }, { count: rejectedCount }, { data: stats }, { data: taste }] = await Promise.all([
        supabase.from("habit_events").select("id", { count: "exact", head: true }).eq("event_type", "suggestion_accepted"),
        supabase.from("habit_events").select("id", { count: "exact", head: true }).eq("event_type", "recipe_rejected"),
        supabase.from("recipe_stats").select("recipe_id, times_planned, times_swapped_out, last_planned, recipes(title)").order("times_planned", { ascending: false }).limit(20),
        supabase.from("taste_profile").select("ingredient_id, score, n_seen, ingredients(name)").order("score", { ascending: false }).limit(40),
      ]);
      setAccepted(acceptedCount ?? 0);
      setRejected(rejectedCount ?? 0);
      setRecipeStats((stats ?? []) as unknown as RecipeStat[]);
      setTasteRows((taste ?? []) as unknown as TasteRow[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const total = accepted + rejected;
  const rate = total > 0 ? Math.round((accepted / total) * 100) : null;
  const liked = tasteRows.filter((t) => t.score > 0).slice(0, 10);
  const disliked = [...tasteRows].filter((t) => t.score < 0).reverse().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Auswertungen</h1>

      <Card>
        <CardHeader><CardTitle>Akzeptanzrate der Wochenvorschläge</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8" />
              <p className="text-sm">Noch keine Wochenvorschläge übernommen oder verworfen.</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold">{rate}%</span>
              <span className="text-sm text-muted-foreground">{accepted} übernommen, {rejected} verworfen</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rezept-Historie (Debug-View)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {recipeStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Planungshistorie.</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Rezept</th>
                  <th className="py-2 pr-3">Geplant</th>
                  <th className="py-2 pr-3">Getauscht</th>
                  <th className="py-2 pr-3">Zuletzt</th>
                </tr>
              </thead>
              <tbody>
                {recipeStats.map((s) => (
                  <tr key={s.recipe_id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">{firstTitle(s.recipes)}</td>
                    <td className="py-2 pr-3">{s.times_planned}</td>
                    <td className="py-2 pr-3">{s.times_swapped_out}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{s.last_planned ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Beliebte Zutaten</CardTitle></CardHeader>
          <CardContent>
            {liked.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Daten.</p> : (
              <ul className="space-y-1 text-sm">
                {liked.map((t) => <li key={t.ingredient_id}>{firstName(t.ingredients)} <span className="text-muted-foreground">({t.score.toFixed(2)})</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Wenig beliebte Zutaten</CardTitle></CardHeader>
          <CardContent>
            {disliked.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Daten.</p> : (
              <ul className="space-y-1 text-sm">
                {disliked.map((t) => <li key={t.ingredient_id}>{firstName(t.ingredients)} <span className="text-muted-foreground">({t.score.toFixed(2)})</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
