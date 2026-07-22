import { notFound } from "next/navigation";
import { RezeptForm, type RecipeFormValues } from "@/components/rezept-form";
import { createClient } from "@/lib/supabase/server";

export default async function RezeptBearbeitenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient();
  const [{ data: recipe }, { data: ingredientRows }, { data: steps }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).single(),
    supabase.from("recipe_ingredients").select("amount,unit,ingredient_id,ingredients(name)").eq("recipe_id", id),
    supabase.from("recipe_steps").select("step_no,text").eq("recipe_id", id).order("step_no"),
  ]);
  if (!recipe) notFound();
  const defaults: RecipeFormValues = { title: recipe.title, source_url: recipe.source_url ?? "", servings_base: recipe.servings_base, prep_min: recipe.prep_min, cook_min: recipe.cook_min, difficulty: recipe.difficulty, tags: recipe.tags ?? [], kid_friendly: recipe.kid_friendly, is_experimental: recipe.is_experimental, steps: (steps ?? []).map((step) => step.text), ingredients: (ingredientRows ?? []).map((row) => ({ amount: String(row.amount), unit: row.unit, ingredient_id: row.ingredient_id, name: ((row.ingredients as unknown as { name: string }[] | null)?.[0])?.name ?? "" })) };
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-8"><h1 className="text-3xl font-semibold">Rezept bearbeiten</h1><RezeptForm defaultValues={defaults} recipeId={id} /></main>;
}
