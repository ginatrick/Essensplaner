"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { BaseUnit } from "@/lib/units/convert";

type PantryRow = { id: string; amount: number; unit: BaseUnit; ingredients: { id: string; name: string } | null };
type IngredientOption = { id: string; name: string; base_unit: BaseUnit };

export function VorraeteView() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<PantryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [amount, setAmount] = useState("");

  async function load() {
    const { data } = await supabase
      .from("pantry")
      .select("id, amount, unit, ingredients(id, name)")
      .order("updated_at", { ascending: false });
    setRows((data ?? []) as unknown as PantryRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchIngredients(text: string) {
    setSearchText(text);
    if (!text.trim()) { setOptions([]); return; }
    const { data } = await supabase.from("ingredients").select("id, name, base_unit").ilike("name", `%${text.replace(/[%_]/g, "\\$&")}%`).limit(8);
    setOptions((data ?? []) as IngredientOption[]);
  }

  async function addStock(ingredient: IngredientOption) {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase
      .from("pantry")
      .upsert(
        { user_id: userData.user.id, ingredient_id: ingredient.id, amount: parsedAmount, unit: ingredient.base_unit, updated_at: new Date().toISOString() },
        { onConflict: "user_id,ingredient_id" }
      );
    setSearchText("");
    setOptions([]);
    setAmount("");
    await load();
  }

  async function removeStock(id: string) {
    await supabase.from("pantry").delete().eq("id", id);
    setRows((list) => list.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vorräte</h1>

      <Card>
        <CardHeader><CardTitle>Zutat hinzufügen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Zutat suchen …"
              value={searchText}
              onChange={(e) => void searchIngredients(e.target.value)}
              className="max-w-xs"
            />
            <Input
              type="number"
              min="0"
              placeholder="Menge"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-[120px]"
            />
          </div>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <Button key={o.id} type="button" variant="outline" className="h-7 text-xs" onClick={() => addStock(o)}>
                  {o.name} ({o.base_unit})
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aktueller Vorrat</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Vorräte erfasst.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{row.ingredients?.name ?? row.id}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{row.amount} {row.unit}</span>
                    <Button type="button" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeStock(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
