// Spiegelt slugify_de() aus supabase/migrations/20260723210000_insert_ingredient_rpc.sql.
// Zutatensuche vergleicht damit gegen ingredients.slug statt gegen name —
// "Kaese"/"Käse" ergeben denselben Slug, unabhängig davon, ob Nutzer oder
// importierter Rezepttext Umlaute oder die ae/oe/ue-Schreibweise verwenden.
export function slugifyDe(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
