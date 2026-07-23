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

export type IngredientMeta = { id: string; name: string; department_id: number | null };
export type DepartmentMeta = { id: number; name: string; sort_order: number };

export type GroupedDepartment = {
  department_id: number | null;
  name: string;
  sort_order: number;
  items: (AggregatedIngredient & { name: string })[];
};

export function groupByDepartment(
  items: AggregatedIngredient[],
  ingredients: Map<string, IngredientMeta>,
  departments: Map<number, DepartmentMeta>
): GroupedDepartment[] {
  const groups = new Map<string, GroupedDepartment>();

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
