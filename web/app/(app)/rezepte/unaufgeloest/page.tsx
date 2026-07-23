import { UnaufgeloestView } from "./unaufgeloest-view";
import { createClient } from "@/lib/supabase/server";

export default async function UnaufgeloestPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_ingredient_drafts")
    .select("id, recipe_id, raw_name, amount, unit, note, recipes(title)")
    .order("recipe_id");

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    recipeId: row.recipe_id,
    recipeTitle: ((row.recipes as unknown as { title: string }[] | null)?.[0])?.title ?? "",
    rawName: row.raw_name,
    amount: row.amount ?? "",
    unit: row.unit ?? "",
    note: row.note,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold">Nicht zugeordnete Zutaten</h1>
        <p className="mt-2 text-muted-foreground">
          Zutatenzeilen aus Importen, die keiner bestehenden Zutat zugeordnet werden konnten. Erst nach Zuordnung zählen sie in Einkaufsliste/Preisvergleich mit.
        </p>
      </div>
      <UnaufgeloestView rows={rows} />
    </main>
  );
}
