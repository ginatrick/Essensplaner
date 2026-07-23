// Zutaten-Aggregation über die Woche (Phase 3, Schritt 1 — noch ohne Pantry/Packungsrundung).
// recipe_ingredients.amount/unit sind bereits Basiseinheit (siehe resolveLine.ts),
// daher ist die Aggregation ein reiner skalierter Summen-Join, keine Unit-Konvertierung nötig.

export type PlanEntryWithIngredients = {
  servings: number;
  recipe: { servings_base: number };
  ingredients: { ingredient_id: string; amount: number; unit: string }[];
};

export type AggregatedIngredient = { ingredient_id: string; amount: number; unit: string };

export function aggregateIngredients(
  entries: PlanEntryWithIngredients[]
): AggregatedIngredient[] {
  const sums = new Map<string, AggregatedIngredient>();

  for (const entry of entries) {
    const factor = entry.recipe.servings_base > 0 ? entry.servings / entry.recipe.servings_base : 1;
    for (const ing of entry.ingredients) {
      const existing = sums.get(ing.ingredient_id);
      if (existing) {
        existing.amount += ing.amount * factor;
      } else {
        sums.set(ing.ingredient_id, { ingredient_id: ing.ingredient_id, amount: ing.amount * factor, unit: ing.unit });
      }
    }
  }

  return [...sums.values()];
}

// Pantry-Abzug: was schon im Vorrat ist, muss nicht mehr gekauft werden.
// Bei Einheiten-Mismatch (sollte durch base_unit-Constraint nicht vorkommen) wird
// der Vorrat ignoriert statt falsch zu rechnen.
export type PantryEntry = { ingredient_id: string; amount: number; unit: string };

export type ShoppingNeed = AggregatedIngredient & { needed: number };

export function subtractPantry(items: AggregatedIngredient[], pantry: Map<string, PantryEntry>): ShoppingNeed[] {
  return items
    .map((item) => {
      const stock = pantry.get(item.ingredient_id);
      const needed = stock && stock.unit === item.unit ? Math.max(0, item.amount - stock.amount) : item.amount;
      return { ...item, needed };
    })
    .filter((item) => item.needed > 0);
}

// Packungsrundung: Bedarf auf ganze Packungen aufrunden, wenn eine Packungsgröße
// bekannt ist. Ohne bekannte Packungsgröße wird der Bedarf unverändert übernommen.
export type PackInfo = { pack_size: number; pack_unit: string };

export type ShoppingItem = ShoppingNeed & { packCount: number | null; buyAmount: number };

export function roundToPackages(items: ShoppingNeed[], packs: Map<string, PackInfo>): ShoppingItem[] {
  return items.map((item) => {
    const pack = packs.get(item.ingredient_id);
    if (!pack || pack.pack_unit !== item.unit || pack.pack_size <= 0) {
      return { ...item, packCount: null, buyAmount: item.needed };
    }
    const packCount = Math.ceil(item.needed / pack.pack_size);
    return { ...item, packCount, buyAmount: packCount * pack.pack_size };
  });
}

export type IngredientMeta = { id: string; name: string; department_id: number | null };
export type DepartmentMeta = { id: number; name: string; sort_order: number };

export type GroupedDepartment<T> = {
  department_id: number | null;
  name: string;
  sort_order: number;
  items: (T & { name: string })[];
};

export function groupByDepartment<T extends { ingredient_id: string }>(
  items: T[],
  ingredients: Map<string, IngredientMeta>,
  departments: Map<number, DepartmentMeta>
): GroupedDepartment<T>[] {
  const groups = new Map<string, GroupedDepartment<T>>();

  for (const item of items) {
    const meta = ingredients.get(item.ingredient_id);
    const dept = meta?.department_id != null ? departments.get(meta.department_id) : undefined;
    const key = dept ? String(dept.id) : "unbekannt";
    if (!groups.has(key)) {
      groups.set(key, {
        department_id: dept?.id ?? null,
        name: dept?.name ?? "Sonstiges",
        sort_order: dept?.sort_order ?? Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    groups.get(key)!.items.push({ ...item, name: meta?.name ?? item.ingredient_id });
  }

  return [...groups.values()].sort((a, b) => a.sort_order - b.sort_order);
}
