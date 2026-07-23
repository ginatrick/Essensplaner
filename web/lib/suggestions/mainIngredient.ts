// Heuristik für die Varianz-Regel (docs/10: "max. 2 Gerichte gleicher
// Hauptzutat pro Woche") — es gibt kein "ist Hauptzutat"-Feld, daher die
// mengenmäßig größte nicht-optionale Zutat (Gewicht/Volumen bevorzugt vor
// Stückgut, da Fleisch/Gemüse-Hauptzutaten meist in g/ml vorliegen).

export type IngredientAmount = { ingredient_id: string; amount: number; unit: string; is_optional: boolean };

export function pickMainIngredient(ingredients: IngredientAmount[]): string | null {
  const nonOptional = ingredients.filter((i) => !i.is_optional);
  const pool = nonOptional.length > 0 ? nonOptional : ingredients;
  if (pool.length === 0) return null;

  const weighed = pool.filter((i) => i.unit === "g" || i.unit === "ml");
  const source = weighed.length > 0 ? weighed : pool;
  return source.reduce((largest, current) => (current.amount > largest.amount ? current : largest)).ingredient_id;
}
