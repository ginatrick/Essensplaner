"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toIngredientBaseUnit } from "@/lib/units/convert";
import { findDuplicateRecipes, type DuplicateCandidate } from "@/lib/recipes/findDuplicates";
import { slugifyDe } from "@/lib/text/slugifyDe";

export type RecipeFormValues = {
  title: string; source_url: string; servings_base: number; prep_min: number | null; cook_min: number | null;
  difficulty: "einfach" | "mittel" | "schwer" | null; tags: string[]; kid_friendly: boolean; is_experimental: boolean;
  /** Bild-URL beim Herausgeber, siehe RawRecipeDraft.image_url. */
  image_path: string | null;
  steps: string[]; ingredients: IngredientRow[];
};
export type IngredientRow = { amount: string; unit: string; name: string; note?: string | null; ingredient_id: string | null; error?: string };

const emptyValues: RecipeFormValues = { title: "", source_url: "", servings_base: 4, prep_min: null, cook_min: null, difficulty: null, tags: [], kid_friendly: false, is_experimental: false, image_path: null, steps: [""], ingredients: [{ amount: "", unit: "", name: "", note: null, ingredient_id: null }] };

export function RezeptForm({ defaultValues, recipeId }: { defaultValues?: Partial<RecipeFormValues>; recipeId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<RecipeFormValues>({ ...emptyValues, ...defaultValues, steps: defaultValues?.steps?.length ? defaultValues.steps : emptyValues.steps, ingredients: defaultValues?.ingredients?.length ? defaultValues.ingredients : emptyValues.ingredients });
  const [tagsText, setTagsText] = useState((defaultValues?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState("");
  // Duplikaterkennung (docs/05-modul-rezepte.md DoD): nur beim Anlegen. Erster
  // Klick mit Treffern warnt und speichert noch nicht, erst der zweite Klick
  // (duplicatesSeen=true) speichert tatsächlich — kein Dialog, ein Flag reicht.
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [duplicatesSeen, setDuplicatesSeen] = useState(false);
  // Neue Zutat anlegen (für Zeilen ohne Treffer, weder Substring noch Fuzzy).
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { createClient().from("departments").select("id,name").order("sort_order").then(({ data }) => setDepartments(data ?? [])); }, []);
  const [newIngredientOpen, setNewIngredientOpen] = useState<number | null>(null);
  const [newIngredient, setNewIngredient] = useState({ base_unit: "g", department_id: "", pack_size: "", pack_unit: "" });
  async function createIngredient(index: number) {
    const row = values.ingredients[index];
    if (!row.name.trim()) return;
    const { data, error } = await createClient().rpc("insert_ingredient", {
      p_name: row.name.trim(),
      p_base_unit: newIngredient.base_unit,
      p_department_id: newIngredient.department_id ? Number(newIngredient.department_id) : null,
      p_pack_size: newIngredient.pack_size ? Number(newIngredient.pack_size) : null,
      p_pack_unit: newIngredient.pack_unit || null,
    });
    if (error || !data) { updateIngredient(index, { error: error?.message ?? "Zutat konnte nicht angelegt werden." }); return; }
    updateIngredient(index, { ingredient_id: data, error: undefined });
    setNewIngredientOpen(null);
    setNewIngredient({ base_unit: "g", department_id: "", pack_size: "", pack_unit: "" });
  }
  const update = <K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  // Funktionales setState-Update (aus v, nicht aus der äußeren values-Closure)
  // — sonst überschreibt ein spät auflösendes updateIngredient (z. B. aus dem
  // debounced Suchergebnis) frischere Tastatureingaben mit einem alten Stand
  // (klassischer React-Stale-Closure-Bug, führte dazu, dass beim Tippen
  // Zeichen wieder verschwanden).
  const updateIngredient = (index: number, change: Partial<IngredientRow>) =>
    setValues((v) => ({ ...v, ingredients: v.ingredients.map((row, i) => (i === index ? { ...row, ...change } : row)) }));
  // Ref statt values-Closure: verfolgt pro Zeile die zuletzt getippte Anfrage,
  // damit eine spät eintreffende Server-Antwort eine schnellere Eingabe nicht
  // überschreibt (values wäre hier zum Aufrufzeitpunkt eingefroren).
  const latestQuery = useRef<Record<number, string>>({});
  // Debounce: die eigentliche Suche (ILIKE + ggf. Fuzzy-RPC) erst starten, wenn
  // kurz nicht mehr getippt wurde — sonst ein DB-Roundtrip pro Tastendruck,
  // spürbar ruckelig. Das Aktualisieren des Eingabefelds selbst (name) bleibt
  // sofort, nur die Netzwerk-Suche wird verzögert.
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const searchIngredient = (index: number, name: string) => {
    updateIngredient(index, { name, ingredient_id: null, error: undefined });
    latestQuery.current[index] = name;
    if (searchTimers.current[index]) clearTimeout(searchTimers.current[index]);
    if (!name.trim()) { setIngredientOptions((options) => ({ ...options, [index]: [] })); return; }
    searchTimers.current[index] = setTimeout(() => void runIngredientSearch(index, name), 300);
  };
  const runIngredientSearch = async (index: number, name: string) => {
    const supabase = createClient();
    // Suche gegen slug statt name: "Kaese"/"Käse" ergeben denselben Slug,
    // findet Treffer unabhängig von Umlaut- vs. ae/oe/ue-Schreibweise.
    const { data: substringMatches, error } = await supabase.from("ingredients").select("id,name").ilike("slug", `%${slugifyDe(name)}%`).limit(8);
    if (latestQuery.current[index] !== name) return;
    if (error) { updateIngredient(index, { error: "Zutatensuche fehlgeschlagen." }); return; }

    let options = substringMatches ?? [];
    // Kein Substring-Treffer -> Ähnlichkeitssuche (Trigram-Fuzzy) als Vorschlag,
    // deckt Tippfehler/andere Schreibweisen ab statt sofort "keine Zutat
    // gefunden" zu melden. Gleiche Schwelle wie web/lib/recipes/lookupAlias.ts.
    if (options.length === 0) {
      const fuzzy = await supabase.rpc("match_ingredient_alias_fuzzy", { search: name.trim(), min_similarity: 0.4, match_limit: 5 });
      if (latestQuery.current[index] !== name) return;
      options = (fuzzy.data ?? []).map((f: { ingredient_id: string; alias: string }) => ({ id: f.ingredient_id, name: f.alias }));
    }

    setIngredientOptions((opts) => ({ ...opts, [index]: options }));
    // Zuordnung nur per explizitem Klick auf einen Vorschlag (selectIngredient),
    // kein Text-Abgleich mehr — war fehleranfällig (Groß-/Kleinschreibung,
    // Normalisierung, Timing bei schnellem Tippen/Datalist-Auswahl).
    updateIngredient(index, { error: options.length ? "Bitte eine Zutat aus den Vorschlägen auswählen." : "Keine Zutat gefunden." });
  };
  function selectIngredient(index: number, item: { id: string; name: string }) {
    updateIngredient(index, { ingredient_id: item.id, name: item.name, error: undefined });
    setIngredientOptions((opts) => ({ ...opts, [index]: [] }));
  }
  const [ingredientOptions, setIngredientOptions] = useState<Record<number, { id: string; name: string }[]>>({});

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    const supabase = createClient(); const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.push("/login"); return; }
    const payload = { title: values.title.trim(), source_url: values.source_url.trim() || null, servings_base: Number(values.servings_base) || 4, prep_min: values.prep_min === null ? null : Number(values.prep_min), cook_min: values.cook_min === null ? null : Number(values.cook_min), difficulty: values.difficulty, tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean), kid_friendly: values.kid_friendly, is_experimental: values.is_experimental, image_path: values.image_path };
    if (!payload.title) { setFormError("Bitte einen Titel eingeben."); setSaving(false); return; }
    if (!recipeId && !duplicatesSeen) {
      const ingredientIds = values.ingredients.map((row) => row.ingredient_id).filter((id): id is string => !!id);
      try {
        const found = await findDuplicateRecipes(supabase, { title: payload.title, ingredientIds });
        if (found.length > 0) { setDuplicates(found); setDuplicatesSeen(true); setSaving(false); return; }
      } catch {
        // Duplikat-Check ist ein Zusatznutzen, kein Grund das Speichern zu blockieren.
      }
    }
    const { data: recipe, error } = recipeId ? await supabase.from("recipes").update(payload).eq("id", recipeId).select("id").single() : await supabase.from("recipes").insert({ ...payload, user_id: userData.user.id }).select("id").single();
    if (error || !recipe) { setFormError(error?.message ?? "Das Rezept konnte nicht gespeichert werden."); setSaving(false); return; }
    if (recipeId) {
      await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
      await supabase.from("recipe_ingredient_drafts").delete().eq("recipe_id", recipe.id);
    }
    const steps = values.steps.map((text, i) => ({ recipe_id: recipe.id, step_no: i + 1, text: text.trim() })).filter((step) => step.text);
    // Einen Durchgang über alle Zeilen, EIN setValues für die Fehler-Annotationen —
    // sonst überschreibt bei mehreren gleichzeitig fehlerhaften Zeilen der letzte
    // updateIngredient()-Aufruf die vorherigen (jeder liest aus demselben,
    // zum Renderzeitpunkt eingefrorenen values.ingredients).
    const annotatedIngredients: IngredientRow[] = [];
    const ingredientRows: { recipe_id: string; ingredient_id: string; amount: number; unit: string; note: string | null }[] = [];
    // Zeilen ohne Zutat-Treffer gehen als Entwurf in recipe_ingredient_drafts,
    // statt beim Speichern stillschweigend verworfen zu werden (vorher:
    // beim nächsten Bearbeiten spurlos verschwunden, siehe Migration
    // 20260723200000_recipe_ingredient_drafts.sql).
    const draftRows: { recipe_id: string; raw_name: string; amount: string | null; unit: string | null; note: string | null }[] = [];
    // Basiseinheit/Dichte der zugeordneten Zutaten holen, um die Menge darauf
    // anzugleichen — "1 TL Salz" ergäbe sonst 5 ml bei einer Zutat, die in g
    // geführt wird, und die Einkaufsliste addiert ml zu g.
    const hitIds = [...new Set(values.ingredients.map((r) => r.ingredient_id).filter((id): id is string => !!id))];
    const { data: unitRows } = hitIds.length
      ? await supabase.from("ingredients").select("id, base_unit, density_g_ml, department_id").in("id", hitIds)
      : { data: [] };
    const unitById = new Map((unitRows ?? []).map((r) => [r.id, r]));
    for (const row of values.ingredients) {
      if (!row.name.trim()) continue; // komplett leere Zeile, nichts zu speichern
      const note = row.note?.trim() || null;
      if (!row.ingredient_id) {
        draftRows.push({ recipe_id: recipe.id, raw_name: row.name.trim(), amount: row.amount || null, unit: row.unit || null, note });
        annotatedIngredients.push(row);
        continue;
      }
      if (!row.amount || !row.unit) { annotatedIngredients.push(row); continue; }
      const amount = Number(row.amount);
      if (!Number.isFinite(amount)) { annotatedIngredients.push({ ...row, error: "Bitte eine gültige Menge eingeben." }); continue; }
      try {
        const target = unitById.get(row.ingredient_id) ?? { base_unit: "g" };
        const converted = toIngredientBaseUnit({ amount, unit: row.unit }, target);
        ingredientRows.push({ recipe_id: recipe.id, ingredient_id: row.ingredient_id, amount: converted.amount, unit: converted.unit, note });
        annotatedIngredients.push({ ...row, error: undefined });
      } catch {
        annotatedIngredients.push({ ...row, error: `Unbekannte Einheit: "${row.unit}"` });
      }
    }
    update("ingredients", annotatedIngredients);
    const stepError = steps.length ? (await supabase.from("recipe_steps").insert(steps)).error : null;
    const ingredientError = ingredientRows.length ? (await supabase.from("recipe_ingredients").insert(ingredientRows)).error : null;
    const draftError = draftRows.length ? (await supabase.from("recipe_ingredient_drafts").insert(draftRows)).error : null;
    if (stepError || ingredientError || draftError) { setFormError(stepError?.message ?? ingredientError?.message ?? draftError?.message ?? "Ein Teil des Rezepts konnte nicht gespeichert werden."); setSaving(false); return; }
    router.push(`/rezepte/${recipe.id}`); router.refresh();
  }
  return <form onSubmit={save} className="space-y-6"><Card><CardHeader><CardTitle>Grunddaten</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="title">Titel *</Label><Input id="title" required value={values.title} onChange={(e) => update("title", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="source">Quelle (URL)</Label><Input id="source" type="url" value={values.source_url} onChange={(e) => update("source_url", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="servings">Portionen</Label><Input id="servings" type="number" min="1" value={values.servings_base} onChange={(e) => update("servings_base", Number(e.target.value))} /></div><div className="space-y-2"><Label htmlFor="prep">Vorbereitung (Min.)</Label><Input id="prep" type="number" min="0" value={values.prep_min ?? ""} onChange={(e) => update("prep_min", e.target.value ? Number(e.target.value) : null)} /></div><div className="space-y-2"><Label htmlFor="cook">Kochen (Min.)</Label><Input id="cook" type="number" min="0" value={values.cook_min ?? ""} onChange={(e) => update("cook_min", e.target.value ? Number(e.target.value) : null)} /></div><div className="space-y-2"><Label htmlFor="difficulty">Schwierigkeit</Label><select id="difficulty" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={values.difficulty ?? ""} onChange={(e) => update("difficulty", (e.target.value || null) as RecipeFormValues["difficulty"])}><option value="">Keine Angabe</option><option>einfach</option><option>mittel</option><option>schwer</option></select></div><div className="space-y-2"><Label htmlFor="tags">Tags (Komma-getrennt)</Label><Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="image">Bild-URL</Label><div className="flex items-center gap-3">{values.image_path && <img src={values.image_path} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}<Input id="image" type="url" placeholder="Wird beim Import automatisch übernommen" value={values.image_path ?? ""} onChange={(e) => update("image_path", e.target.value || null)} /></div></div><div className="flex gap-6 sm:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.kid_friendly} onChange={(e) => update("kid_friendly", e.target.checked)} /> Kinderfreundlich</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.is_experimental} onChange={(e) => update("is_experimental", e.target.checked)} /> Experimentell</label></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Zubereitung</CardTitle></CardHeader><CardContent className="space-y-3">{values.steps.map((step, index) => <div className="flex gap-2" key={index}><span className="pt-2 text-sm text-muted-foreground">{index + 1}.</span><Textarea value={step} onChange={(e) => update("steps", values.steps.map((s, i) => i === index ? e.target.value : s))} placeholder="Zubereitungsschritt" /><Button type="button" variant="outline" onClick={() => update("steps", values.steps.filter((_, i) => i !== index))} disabled={values.steps.length === 1}>Entfernen</Button>{index > 0 && <Button type="button" variant="outline" onClick={() => { const next = [...values.steps]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update("steps", next); }}>↑</Button>}{index < values.steps.length - 1 && <Button type="button" variant="outline" onClick={() => { const next = [...values.steps]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; update("steps", next); }}>↓</Button>}</div>)}<Button type="button" variant="outline" onClick={() => update("steps", [...values.steps, ""])}>+ Schritt</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Zutaten</CardTitle></CardHeader><CardContent className="space-y-3">{values.ingredients.map((row, index) => <div className="rounded-lg border p-3" key={index}><div className="grid gap-2 sm:grid-cols-[7rem_7rem_1fr_auto]"><Input type="number" min="0" step="any" placeholder="Menge" value={row.amount} onChange={(e) => updateIngredient(index, { amount: e.target.value, error: undefined })} /><Input placeholder="Einheit (z. B. EL)" value={row.unit} onChange={(e) => updateIngredient(index, { unit: e.target.value, error: undefined })} /><div><Input placeholder="Zutat suchen" value={row.name} onChange={(e) => searchIngredient(index, e.target.value)} aria-invalid={!!row.error} />{!row.ingredient_id && (ingredientOptions[index]?.length ?? 0) > 0 && <div className="mt-1 flex flex-wrap gap-1">{ingredientOptions[index]!.map((item) => <Button key={item.id} type="button" variant="outline" className="h-6 text-xs" onClick={() => selectIngredient(index, item)}>{item.name}</Button>)}</div>}</div><Button type="button" variant="outline" onClick={() => setValues((v) => ({ ...v, ingredients: v.ingredients.filter((_, i) => i !== index) }))}>Entfernen</Button></div><Input className="mt-2" placeholder="Notiz (z. B. Abtropfgewicht, Zubereitungshinweis)" value={row.note ?? ""} onChange={(e) => updateIngredient(index, { note: e.target.value })} />{row.error && <p className="mt-2 text-sm text-destructive">{row.error}</p>}{row.ingredient_id && <p className="mt-2 text-sm text-green-700">Zutat ausgewählt</p>}
      {!row.ingredient_id && row.name.trim() && (newIngredientOpen === index ? <div className="mt-2 space-y-2 rounded-md border border-dashed p-3"><p className="text-sm font-medium">Neue Zutat „{row.name.trim()}“ anlegen</p><div className="grid gap-2 sm:grid-cols-4"><select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.base_unit} onChange={(e) => setNewIngredient((v) => ({ ...v, base_unit: e.target.value }))}><option value="g">g</option><option value="ml">ml</option><option value="stk">Stück</option></select><select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.department_id} onChange={(e) => setNewIngredient((v) => ({ ...v, department_id: e.target.value }))}><option value="">Abteilung (optional)</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><Input placeholder="Füllmenge (optional)" type="number" min="0" value={newIngredient.pack_size} onChange={(e) => setNewIngredient((v) => ({ ...v, pack_size: e.target.value }))} /><select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.pack_unit} onChange={(e) => setNewIngredient((v) => ({ ...v, pack_unit: e.target.value }))}><option value="">Füll-Einheit</option><option value="g">g</option><option value="ml">ml</option><option value="stk">Stück</option></select></div><div className="flex gap-2"><Button type="button" className="h-8 text-xs" onClick={() => createIngredient(index)}>Anlegen &amp; zuordnen</Button><Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setNewIngredientOpen(null)}>Abbrechen</Button></div></div> : <Button type="button" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setNewIngredientOpen(index)}>Neue Zutat „{row.name.trim()}“ anlegen</Button>)}
      </div>)}<Button type="button" variant="outline" onClick={() => setValues((v) => ({ ...v, ingredients: [...v.ingredients, { amount: "", unit: "", name: "", note: null, ingredient_id: null }] }))}>+ Zutat</Button></CardContent></Card>
    {duplicates.length > 0 && <div className="space-y-1 rounded-md border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-900">{duplicates.map((d) => <p key={d.recipeId}>Ähnliches Rezept bereits vorhanden: <a className="underline" href={`/rezepte/${d.recipeId}`}>{d.title}</a> ({Math.round(d.score * 100)}% ähnlich)</p>)}</div>}
    {formError && <p className="text-sm text-destructive">{formError}</p>}<Button type="submit" disabled={saving}>{saving ? "Wird gespeichert …" : recipeId ? "Änderungen speichern" : duplicates.length > 0 ? "Trotzdem speichern" : "Rezept anlegen"}</Button></form>;
}
