"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toBaseUnit } from "@/lib/units/convert";

export type DraftRow = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  rawName: string;
  amount: string;
  unit: string;
  note: string | null;
};

// Eigenständige, schlanke Variante der Zutaten-Suche aus rezept-form.tsx
// (Debounce + Substring/Fuzzy + Neu-anlegen) — hier ohne die übrigen
// Rezeptformular-Felder drumherum, dafür über alle Rezepte hinweg auf
// einen Blick, gedacht fürs Nacharbeiten nach einem Massenimport.
export function UnaufgeloestView({ rows: initialRows }: { rows: DraftRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [amounts, setAmounts] = useState<Record<string, { amount: string; unit: string }>>(
    Object.fromEntries(initialRows.map((r) => [r.id, { amount: r.amount, unit: r.unit }])),
  );
  const [options, setOptions] = useState<Record<string, { id: string; name: string }[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState({ base_unit: "g", department_id: "", pack_size: "", pack_unit: "" });
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { createClient().from("departments").select("id,name").order("sort_order").then(({ data }) => setDepartments(data ?? [])); }, []);

  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestQuery = useRef<Record<string, string>>({});

  function search(rowId: string, name: string) {
    latestQuery.current[rowId] = name;
    if (searchTimers.current[rowId]) clearTimeout(searchTimers.current[rowId]);
    if (!name.trim()) { setOptions((o) => ({ ...o, [rowId]: [] })); return; }
    searchTimers.current[rowId] = setTimeout(() => void runSearch(rowId, name), 300);
  }

  async function runSearch(rowId: string, name: string) {
    const supabase = createClient();
    const { data: substringMatches } = await supabase.from("ingredients").select("id,name").ilike("name", `%${name.replace(/[%_]/g, "\\$&")}%`).limit(8);
    if (latestQuery.current[rowId] !== name) return;
    let opts = substringMatches ?? [];
    if (opts.length === 0) {
      const fuzzy = await supabase.rpc("match_ingredient_alias_fuzzy", { search: name.trim(), min_similarity: 0.4, match_limit: 5 });
      if (latestQuery.current[rowId] !== name) return;
      opts = (fuzzy.data ?? []).map((f: { ingredient_id: string; alias: string }) => ({ id: f.ingredient_id, name: f.alias }));
    }
    setOptions((o) => ({ ...o, [rowId]: opts }));
  }

  async function resolve(row: DraftRow, ingredientId: string) {
    const { amount, unit } = amounts[row.id];
    if (!amount || !unit) { setErrors((e) => ({ ...e, [row.id]: "Bitte Menge und Einheit angeben." })); return; }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) { setErrors((e) => ({ ...e, [row.id]: "Ungültige Menge." })); return; }
    let converted;
    try {
      converted = toBaseUnit({ amount: parsedAmount, unit });
    } catch {
      setErrors((e) => ({ ...e, [row.id]: `Unbekannte Einheit: "${unit}"` }));
      return;
    }
    const supabase = createClient();
    const { error: insertError } = await supabase.from("recipe_ingredients").insert({
      recipe_id: row.recipeId, ingredient_id: ingredientId, amount: converted.amount, unit: converted.unit, note: row.note,
    });
    if (insertError) { setErrors((e) => ({ ...e, [row.id]: insertError.message })); return; }
    await supabase.from("recipe_ingredient_drafts").delete().eq("id", row.id);
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    router.refresh();
  }

  async function discard(row: DraftRow) {
    await createClient().from("recipe_ingredient_drafts").delete().eq("id", row.id);
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  }

  async function createIngredient(row: DraftRow) {
    const { data, error } = await createClient().rpc("insert_ingredient", {
      p_name: row.rawName.trim(),
      p_base_unit: newIngredient.base_unit,
      p_department_id: newIngredient.department_id ? Number(newIngredient.department_id) : null,
      p_pack_size: newIngredient.pack_size ? Number(newIngredient.pack_size) : null,
      p_pack_unit: newIngredient.pack_unit || null,
    });
    if (error || !data) { setErrors((e) => ({ ...e, [row.id]: error?.message ?? "Zutat konnte nicht angelegt werden." })); return; }
    setNewOpen(null);
    setNewIngredient({ base_unit: "g", department_id: "", pack_size: "", pack_unit: "" });
    await resolve(row, data);
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Keine offenen Zuordnungen — alles erledigt.</p>;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            aus <Link className="underline" href={`/rezepte/${row.recipeId}`}>{row.recipeTitle}</Link>
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-[7rem_7rem_1fr]">
            <Input type="number" min="0" step="any" placeholder="Menge" value={amounts[row.id]?.amount ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [row.id]: { ...a[row.id], amount: e.target.value } }))} />
            <Input placeholder="Einheit" value={amounts[row.id]?.unit ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [row.id]: { ...a[row.id], unit: e.target.value } }))} />
            <div>
              <Input defaultValue={row.rawName} placeholder="Zutat suchen" onChange={(e) => search(row.id, e.target.value)} />
              {(options[row.id]?.length ?? 0) > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {options[row.id]!.map((item) => (
                    <Button key={item.id} type="button" variant="outline" className="h-6 text-xs" onClick={() => resolve(row, item.id)}>{item.name}</Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {row.note && <p className="mt-1 text-xs text-muted-foreground">Notiz: {row.note}</p>}
          {errors[row.id] && <p className="mt-2 text-sm text-destructive">{errors[row.id]}</p>}
          <div className="mt-2 flex gap-2">
            {newOpen === row.id ? (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <p className="text-sm font-medium">Neue Zutat „{row.rawName}“ anlegen</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.base_unit} onChange={(e) => setNewIngredient((v) => ({ ...v, base_unit: e.target.value }))}>
                    <option value="g">g</option><option value="ml">ml</option><option value="stk">Stück</option>
                  </select>
                  <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.department_id} onChange={(e) => setNewIngredient((v) => ({ ...v, department_id: e.target.value }))}>
                    <option value="">Abteilung (optional)</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <Input placeholder="Füllmenge (optional)" type="number" min="0" value={newIngredient.pack_size} onChange={(e) => setNewIngredient((v) => ({ ...v, pack_size: e.target.value }))} />
                  <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={newIngredient.pack_unit} onChange={(e) => setNewIngredient((v) => ({ ...v, pack_unit: e.target.value }))}>
                    <option value="">Füll-Einheit</option><option value="g">g</option><option value="ml">ml</option><option value="stk">Stück</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" className="h-8 text-xs" onClick={() => createIngredient(row)}>Anlegen &amp; zuordnen</Button>
                  <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setNewOpen(null)}>Abbrechen</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setNewOpen(row.id)}>Neue Zutat anlegen</Button>
            )}
            <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => discard(row)}>Zeile verwerfen</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
