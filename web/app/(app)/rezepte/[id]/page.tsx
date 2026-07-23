import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { RezeptDeleteButton } from "@/components/rezept-delete-button";

export default async function RezeptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient();
  const [{ data: recipe }, { data: ingredients }, { data: drafts }, { data: steps }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).single(),
    supabase.from("recipe_ingredients").select("amount,unit,note,ingredients(name)").eq("recipe_id", id),
    supabase.from("recipe_ingredient_drafts").select("amount,unit,raw_name,note").eq("recipe_id", id),
    supabase.from("recipe_steps").select("step_no,text").eq("recipe_id", id).order("step_no"),
  ]);
  if (!recipe) notFound();
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">{recipe.title}</h1><p className="text-muted-foreground">{(recipe.prep_min ?? 0) + (recipe.cook_min ?? 0)} Min. · {recipe.servings_base} Portionen</p></div><div className="flex gap-2"><Link className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium" href={`/rezepte/${id}/bearbeiten`}>Bearbeiten</Link><RezeptDeleteButton id={id} /></div></div>{recipe.source_url && <a className="text-sm text-blue-700 underline" href={recipe.source_url} target="_blank" rel="noreferrer">Originalquelle öffnen</a>}<Card><CardHeader><CardTitle>Zutaten</CardTitle></CardHeader><CardContent><ul className="space-y-2">{ingredients?.map((item, index) => { const ingredient = (item.ingredients as unknown as { name: string }[] | null)?.[0]; return <li key={index}>{item.amount} {item.unit} {ingredient?.name}{item.note && ` – ${item.note}`}</li>; })}{drafts?.map((draft, index) => <li key={`draft-${index}`} className="text-amber-800">{draft.amount} {draft.unit} {draft.raw_name}{draft.note && ` – ${draft.note}`} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs">nicht zugeordnet</span></li>)}</ul></CardContent></Card><Card><CardHeader><CardTitle>Zubereitung</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-3 pl-5">{steps?.map((step) => <li key={step.step_no}>{step.text}</li>)}</ol></CardContent></Card></main>;
}
