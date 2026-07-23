"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type OfferRow = {
  id: string;
  raw_title: string;
  brand: string | null;
  price_cent: number;
  unit: string | null;
  confidence: number;
  stores: { name: string; chain: string } | { name: string; chain: string }[] | null;
};

type IngredientOption = { id: string; name: string };

function storeLabel(stores: OfferRow["stores"]): string {
  const store = Array.isArray(stores) ? stores[0] : stores;
  return store ? `${store.chain} — ${store.name}` : "";
}

// Review-Queue nach confidence gruppieren, damit dieselbe rohe Zutat (mehrfach
// pro Filiale der Kette, siehe ingest/matching/offers.py Fan-out) nur einmal
// bearbeitet werden muss, statt pro Filiale einzeln.
function groupByRawTitle(rows: OfferRow[]): { raw_title: string; brand: string | null; price_cent: number; unit: string | null; ids: string[] }[] {
  const groups = new Map<string, { raw_title: string; brand: string | null; price_cent: number; unit: string | null; ids: string[] }>();
  for (const row of rows) {
    const key = row.raw_title;
    if (!groups.has(key)) {
      groups.set(key, { raw_title: row.raw_title, brand: row.brand, price_cent: row.price_cent, unit: row.unit, ids: [] });
    }
    groups.get(key)!.ids.push(row.id);
  }
  return [...groups.values()];
}

export function AngeboteReviewView() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [options, setOptions] = useState<IngredientOption[]>([]);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("offers")
      .select("id, raw_title, brand, price_cent, unit, confidence, stores(name, chain)")
      .lt("confidence", 0.7)
      .order("raw_title");
    if (loadError) { setError("Angebote konnten nicht geladen werden."); setLoading(false); return; }
    setRows((data ?? []) as unknown as OfferRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchIngredients(text: string) {
    setSearchText(text);
    if (!text.trim()) { setOptions([]); return; }
    const { data } = await supabase.from("ingredients").select("id, name").ilike("name", `%${text.replace(/[%_]/g, "\\$&")}%`).limit(8);
    setOptions((data ?? []) as IngredientOption[]);
  }

  async function assign(offerIds: string[], ingredientId: string) {
    for (const offerId of offerIds) {
      await supabase.rpc("resolve_offer_match", { p_offer_id: offerId, p_ingredient_id: ingredientId });
    }
    setRows((list) => list.filter((r) => !offerIds.includes(r.id)));
    setActiveGroup(null);
    setSearchText("");
    setOptions([]);
  }

  const groups = groupByRawTitle(rows);
  const groupStore = (raw_title: string) => storeLabel(rows.find((r) => r.raw_title === raw_title)?.stores ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Angebote prüfen</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Unsichere Zuordnungen</CardTitle>
            {groups.length > 0 && <span className="text-xs text-muted-foreground">{groups.length} zu prüfen</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Tag className="h-8 w-8" />
              <p className="text-sm">Keine unsicheren Zuordnungen — alles geprüft.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {groups.map((group) => (
                <li key={group.raw_title} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{group.raw_title}{group.brand && <span className="text-muted-foreground"> · {group.brand}</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        {(group.price_cent / 100).toFixed(2)} € {group.unit ? `· ${group.unit}` : ""} · {groupStore(group.raw_title)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => { setActiveGroup(group.raw_title); setSearchText(""); setOptions([]); }}
                    >
                      Zutat zuordnen
                    </Button>
                  </div>
                  {activeGroup === group.raw_title && (
                    <div className="mt-2">
                      <Input
                        autoFocus
                        placeholder="Zutat suchen …"
                        value={searchText}
                        onChange={(e) => void searchIngredients(e.target.value)}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {options.map((o) => (
                          <Button key={o.id} type="button" variant="outline" className="h-7 text-xs" onClick={() => assign(group.ids, o.id)}>
                            {o.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
