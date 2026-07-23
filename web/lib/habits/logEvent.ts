import type { SupabaseClient } from "@supabase/supabase-js";

// Gewichte aus docs/10-modul-lernen.md — hier nur als Referenz/Dokumentation,
// die eigentliche Gewichtung passiert in der nightly Aggregation (SQL).
export type HabitEventType =
  | "recipe_kept"
  | "suggestion_accepted"
  | "recipe_manual_add"
  | "item_unchecked"
  | "recipe_swapped"
  | "recipe_rejected";

export async function logHabitEvent(
  supabase: SupabaseClient,
  input: { eventType: HabitEventType; recipeId?: string | null; ingredientId?: string | null; payload?: Record<string, unknown> },
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from("habit_events").insert({
    user_id: userData.user.id,
    event_type: input.eventType,
    recipe_id: input.recipeId ?? null,
    ingredient_id: input.ingredientId ?? null,
    payload: input.payload ?? null,
  });
}
