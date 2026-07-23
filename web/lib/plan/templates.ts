// Reine Kopier-Logik für Wochenplan-Vorlagen (keine Supabase-Calls hier,
// damit sie ohne Mocking testbar bleibt).

export type PlanEntryRow = {
  day: number;
  slot: string;
  recipe_id: string;
  servings: number;
  pinned: boolean;
};

/** Baut die Insert-Payload für meal_plan_entries, um `rows` in `targetPlanId` zu kopieren. */
export function entriesForPlan(targetPlanId: string, rows: PlanEntryRow[]) {
  return rows.map((r) => ({
    plan_id: targetPlanId,
    day: r.day,
    slot: r.slot,
    recipe_id: r.recipe_id,
    servings: r.servings,
    pinned: r.pinned,
  }));
}
