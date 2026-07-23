export type CandidateRecipe = {
  id: string;
  title: string;
  tags: string[] | null;
  prep_min: number | null;
  cook_min: number | null;
  is_experimental: boolean;
  lastPlanned: string | null; // ISO-Datum, null = nie geplant
  tasteScore: number | null; // Rezept-Ebene, null = unbekannt (neues Rezept)
  mainIngredientId: string | null; // für die Varianz-Regel (max. 2 gleiche Hauptzutat/Woche)
  inSeason: boolean; // false nur, wenn das Rezept eine Saison-Zutat hat, die gerade NICHT Saison hat
  ingredientNutrients: { iron_mg_100: number | null; calcium_mg_100: number | null }[];
};

export type SuggestedSlot = {
  day: number;
  recipe: CandidateRecipe;
  isExploration: boolean;
};
